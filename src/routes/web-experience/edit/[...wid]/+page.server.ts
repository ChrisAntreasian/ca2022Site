import { error, fail, isHttpError, redirect } from "@sveltejs/kit";

import {
  isEditorUnlockedForRequest,
  requireEditorAccess,
} from "#lib/editing/core/session.server";
import {
  applyWebExperienceMediaPatch,
  buildWebExperienceTarget,
  toWebExperienceEditorValue,
  webExperienceEditorDefinition,
  type WebExperienceEntry,
  type WebExperienceFile,
} from "#lib/editing/resources/web-experience/web-experience";
import {
  deleteWebExperienceEntry,
  deleteWebExperienceMedia,
  ensureWebExperienceBaselineSnapshot,
  listWebExperienceEditorHistoryVersions,
  persistWebExperienceUpload,
  readWebExperienceEditorSnapshotEntries,
  readWebExperienceFile,
  restoreWebExperienceEditorEntryFromSnapshot,
  saveWebExperienceEditorValue,
  writeWebExperienceFile,
  type RestoreWebExperienceEditorEntryParams,
} from "#lib/editing/resources/web-experience/web-experience.server";
import {
  mergeWebExperienceValue,
  parseWebExperienceEditorParam,
  parseWebExperienceForm,
  selectWebExperienceTarget,
  webExperienceEditorPath,
} from "#lib/editing/resources/web-experience/web-experience-editor";
import { getFormDataString } from "#lib/form-data";

import type { SnapshotScope } from "#lib/dataStore.server";
import type { Actions, PageServerLoad } from "./$types";

const resolveSavedEntry = (
  entries: ReadonlyArray<WebExperienceEntry>,
  requestedEntryId: number,
) =>
  requestedEntryId > 0
    ? (entries.find((entry) => entry.id === requestedEntryId) ?? null)
    : ([...entries].sort((left, right) => right.id - left.id)[0] ?? null);

/**
 * How many saved versions the restore picker shows. The seam answers with what it is asked for, and the
 * store's own default (`100`) is a whole history listing rather than a preview, so a screen that can render
 * five has to say so.
 */
const MAX_RESTORE_VERSIONS = 5;

/**
 * What each of the three tiers a version can be found in is called in the picker.
 *
 * `live` is called "published version" because a version in the live tier is not somebody's working copy, and
 * an editor choosing between two snapshots has to be able to tell them apart. `legacy` is the flat pre-S3
 * layout the local copies sit in: those copies are restorable but have never been published, so they get a
 * name that says where they came from rather than a tier word an editor would have to look up.
 */
const TIER_LABELS: Record<SnapshotScope, string> = {
  draft: "(draft)",
  live: "(published version)",
  legacy: "(pre-S3 copy)",
};

/** A version is named by a whole number of milliseconds - the same rule the stores name snapshot files by. */
const POSITIVE_INTEGER_RX = /^[1-9][0-9]*$/;

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const parsePositiveInteger = (raw: string | null): number | null => {
  if (raw === null || !POSITIVE_INTEGER_RX.test(raw)) return null;

  const value = Number(raw);

  return Number.isSafeInteger(value) ? value : null;
};

const parseRestoreScope = (raw: string | null): SnapshotScope | null => {
  if (raw === "draft" || raw === "live" || raw === "legacy") return raw;

  return null;
};

/**
 * A snapshot timestamp in the words an editor reads: "4 November 2026 at 06:51".
 *
 * Built out of UTC parts rather than through `Intl.DateTimeFormat`, on purpose: with an implicit locale an
 * `Intl` formatter says one thing in a browser set to en-US, another in one set to de-DE, and a third thing on
 * the server that builds the status line - and a version the page names in one set of words and the status line
 * in another is exactly the confusion this line exists to remove. UTC because the number a version is named
 * after is a UTC millisecond value.
 */
const formatVersionLabel = (timestamp: number): string => {
  const stamp = new Date(timestamp);

  return `${stamp.getUTCDate()} ${MONTH_NAMES[stamp.getUTCMonth()]} ${stamp.getUTCFullYear()} at ${String(
    stamp.getUTCHours(),
  ).padStart(2, "0")}:${String(stamp.getUTCMinutes()).padStart(2, "0")}`;
};

/** The words a refusal is said in, whichever of the ways it failed. */
const RESTORE_REFUSAL_MESSAGE =
  "Nothing was restored: that version could not be read, or no longer holds that entry. Your current draft is unchanged.";

const RESTORE_READ_NOTE =
  "That version could not be read. Pick a version from the list below - nothing has been written to your draft.";

const RESTORE_NAME_NOTE =
  "A version to restore must be named by a timestamp and one of draft, live or legacy. Pick a version from the list below.";

const tierLabel = (scope: SnapshotScope) => TIER_LABELS[scope];

type RestoreVersionItem = {
  timestamp: number;
  scope: SnapshotScope;
  dateLabel: string;
  tierLabel: string;
  href: string;
};

type RestoreEntryItem = {
  id: number;
  title: string;
  /** Whether the current draft still holds this entry (`will replace`) or lost it (`will bring back`). */
  willReplace: boolean;
};

type RestoreTarget = {
  timestamp: number;
  scope: SnapshotScope;
  dateLabel: string;
  tierLabel: string;
  entries: RestoreEntryItem[];
};

type RestorePanel = {
  open: boolean;
  href: string;
  closeHref: string;
  versionsHref: string;
  actionHref: string;
  draftVersion: number;
  note: string | null;
  versions: RestoreVersionItem[];
  target: RestoreTarget | null;
};

type EditorStatus = { title: string; message: string };

/**
 * The restore seam's outcome, kept as a value instead of an exception.
 *
 * A refusal has to reach the editor as `?restore-failed=1`, and a redirect is itself a thrown value: reading
 * the seam inside a `try` whose `catch` throws a redirect would let a redirect catch its own page. So the seam's
 * own failures are collected here and the action decides what the editor is told.
 *
 * What the seam dressed itself - a version that is not held in that tier, or a saved copy that is not a web
 * experience file - arrives as an HTTP error and is reported to the editor without a log, because the seam
 * already named it. Everything else is written to the log first: an unreachable bucket, a draft that has never
 * been written, a version that never held the entry. "Nothing was restored" is not an explanation of a store
 * that is down, and this page is not allowed to call an outage a missing version.
 */
const attemptWebExperienceRestore = async (
  params: RestoreWebExperienceEditorEntryParams,
): Promise<{ ok: true; file: WebExperienceFile } | { ok: false }> => {
  try {
    return {
      ok: true,
      file: await restoreWebExperienceEditorEntryFromSnapshot(params),
    };
  } catch (err) {
    if (!isHttpError(err)) {
      console.error(
        `web experience restore: ${params.scope} version refused`,
        err,
      );
    }

    return { ok: false };
  }
};

/**
 * The restore picker's data, built from the URL alone.
 *
 * Two steps: `?restore=1` asks for the version list, and `?restore=1` with a timestamp and a tier asks for one
 * version's entries. Only one of them is ever asked for, and the ordinary editor view - no `?restore` at all -
 * pays for no history read whatsoever.
 */
const buildRestorePanel = async ({
  url,
  entries,
  draftVersion,
}: {
  url: URL;
  entries: ReadonlyArray<WebExperienceEntry>;
  draftVersion: number;
}): Promise<RestorePanel> => {
  const editorPath = url.pathname;
  const panel: RestorePanel = {
    open: false,
    href: `${editorPath}?restore=1`,
    closeHref: editorPath,
    versionsHref: `${editorPath}?restore=1`,
    actionHref: `${editorPath}?/restore`,
    draftVersion,
    note: null,
    versions: [],
    target: null,
  };

  // `?restore` is a sentinel meaning "this dialog is open", and its value is never read. Every control that
  // opens it writes `?restore=1`, so parsing the value as a version number is how a timestamp from 1970 would
  // arrive at a store - which is why the versions step 2 is named by its own `restoreVersion` parameter.
  if (!url.searchParams.has("restore")) return panel;

  panel.open = true;

  panel.versions = [
    ...(await listWebExperienceEditorHistoryVersions(MAX_RESTORE_VERSIONS)),
  ]
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, MAX_RESTORE_VERSIONS)
    .map((version) => ({
      timestamp: version.timestamp,
      scope: version.scope,
      dateLabel: formatVersionLabel(version.timestamp),
      tierLabel: tierLabel(version.scope),
      href: `${editorPath}?restore=1&restoreVersion=${version.timestamp}&restoreScope=${version.scope}`,
    }));

  const namedVersion =
    url.searchParams.has("restoreVersion") ||
    url.searchParams.has("restoreScope");

  if (!namedVersion) return panel;

  const timestamp = parsePositiveInteger(
    url.searchParams.get("restoreVersion"),
  );
  const scope = parseRestoreScope(url.searchParams.get("restoreScope"));

  if (timestamp === null || scope === null) {
    // Refused here, out loud: a version number that is not a whole number, or a tier that is not one of the
    // three, is never sent to the seam - and reading nothing is what keeps a hand-edited link harmless.
    panel.note = RESTORE_NAME_NOTE;

    return panel;
  }

  try {
    const snapshotEntries = await readWebExperienceEditorSnapshotEntries(
      scope,
      timestamp,
    );
    const currentIds = new Set(entries.map((entry) => entry.id));

    panel.target = {
      timestamp,
      scope,
      dateLabel: formatVersionLabel(timestamp),
      tierLabel: tierLabel(scope),
      entries: snapshotEntries.map((entry) => ({
        id: entry.id,
        title: entry.title,
        willReplace: currentIds.has(entry.id),
      })),
    };

    return panel;
  } catch (err) {
    if (!isHttpError(err)) {
      console.error(
        `web experience restore: could not read ${scope} version`,
        err,
      );
    }

    panel.note = RESTORE_READ_NOTE;

    return panel;
  }
};

/**
 * The line the editor shows after an action - the two the editor already had, plus the two a restore builds.
 *
 * The restore statuses are checked last so an editor URL that meant something before this page could restore
 * still means the same thing.
 */
const buildEditorStatus = (
  url: URL,
  entries: ReadonlyArray<WebExperienceEntry>,
): EditorStatus | null => {
  if (url.searchParams.get("deleted") === "1") {
    return {
      title: "Web experience entry deleted",
      message: "Web experience entry deleted.",
    };
  }

  if (url.searchParams.get("saved") === "1") {
    return {
      title: "Web experience entry saved",
      message: "Web experience entry saved.",
    };
  }

  if (url.searchParams.has("restore-failed")) {
    return { title: "Nothing restored", message: RESTORE_REFUSAL_MESSAGE };
  }

  return buildRestoreStatus(url, entries);
};

/**
 * The success line: which entry, and which version it came back out of. A line that only said "saved" would
 * leave an editor guessing which of the versions they were offered the entry came from.
 *
 * A `?restored` this function cannot read (a hand-edited link) says nothing at all rather than claiming nothing
 * happened: it cannot tell the difference between a restore that just worked and an old link somebody pasted
 * again.
 */
const buildRestoreStatus = (
  url: URL,
  entries: ReadonlyArray<WebExperienceEntry>,
): EditorStatus | null => {
  const rawTimestamp = url.searchParams.get("restored");

  if (rawTimestamp === null) return null;

  const timestamp = parsePositiveInteger(rawTimestamp);
  const entryId = parsePositiveInteger(url.searchParams.get("entry"));

  if (timestamp === null || entryId === null) return null;

  const scope = parseRestoreScope(url.searchParams.get("scope"));
  const title = entries.find((entry) => entry.id === entryId)?.title?.trim();
  const tier = scope === null ? "" : ` ${tierLabel(scope)}`;

  return {
    title: "Restore complete",
    message: `Restored ${
      title ? `"${title}"` : "a web experience entry"
    } from the version saved ${formatVersionLabel(timestamp)}${tier}.`,
  };
};
export const load: PageServerLoad = async ({ cookies, params, url }) => {
  requireEditorAccess(cookies);

  const requestedSelection = params.wid
    ? parseWebExperienceEditorParam(params.wid)
    : null;

  if (!requestedSelection && params.wid) {
    throw error(404, "Web experience editor route not found.");
  }

  const source = await readWebExperienceFile();
  await ensureWebExperienceBaselineSnapshot(source);
  const editorValue = toWebExperienceEditorValue(source);
  const selection =
    requestedSelection ??
    (editorValue.entries[0]
      ? ({ kind: "entry", id: editorValue.entries[0].id } as const)
      : ({ kind: "intro" } as const));
  const target = buildWebExperienceTarget(source, editorValue, selection);

  if (!target) {
    throw error(404, "Web experience target not found.");
  }

  const status = buildEditorStatus(url, editorValue.entries);
  const restore = await buildRestorePanel({
    url,
    entries: editorValue.entries,
    // The draft this restore would replace. The restore action never uses it to decide anything: it is T9's
    // placeholder, and it is 0 exactly while nothing has been written.
    draftVersion: source.timestamp,
  });

  return {
    editorEnabled: isEditorUnlockedForRequest(cookies),
    savedTitle: status?.title ?? null,
    savedMessage: status?.message ?? null,
    restore,
    editor: {
      key: webExperienceEditorDefinition.key,
      label: webExperienceEditorDefinition.label,
      introPath: webExperienceEditorPath({ kind: "intro" }),
      newPath: webExperienceEditorPath({ kind: "new" }),
    },
    pageTitle: editorValue.pageTitle,
    entries: editorValue.entries,
    target,
  };
};

export const actions: Actions = {
  save: async ({ cookies, request }) => {
    requireEditorAccess(cookies);

    const source = await readWebExperienceFile();
    const formData = await request.formData();
    const parsedForm = parseWebExperienceForm(formData);
    const current = toWebExperienceEditorValue(source);
    const redirectTo = getFormDataString(formData, "redirectTo").trim();
    const merged = mergeWebExperienceValue(current, parsedForm);

    if (
      !merged.pageTitle.trim() ||
      !merged.introTitle.trim() ||
      !merged.introBodyMarkdown.trim() ||
      merged.entries.some(
        (entry) =>
          !entry.title.trim() ||
          !entry.bodyMarkdown.trim() ||
          !entry.primaryLink.trim() ||
          Number.isNaN(entry.sortOrder),
      )
    ) {
      return fail(400, {
        action: "save",
        message: "Please complete the required fields before saving.",
        values:
          formData.get("kind") === "intro"
            ? {
                kind: "intro",
                pageTitle: merged.pageTitle,
                title: merged.introTitle,
                bodyMarkdown: merged.introBodyMarkdown,
              }
            : selectWebExperienceTarget(merged, {
                kind: "entry",
                id: Number(getFormDataString(formData, "id") || "0"),
              }),
      });
    }

    const removeLogo =
      parsedForm.kind === "entry" && formData.has("removeLogo");
    const removeImageIds =
      parsedForm.kind === "entry"
        ? formData
            .getAll("removeImageIds")
            .map((value) => Number(String(value)))
            .filter((value) => Number.isInteger(value) && value > 0)
        : [];

    const logoRaw = formData.get("logoFile");
    const logoFile =
      parsedForm.kind === "entry" && logoRaw instanceof File && logoRaw.size > 0
        ? logoRaw
        : null;
    const screenshotFiles =
      parsedForm.kind === "entry"
        ? formData
            .getAll("imageFiles")
            .filter(
              (candidate): candidate is File =>
                candidate instanceof File && candidate.size > 0,
            )
        : [];

    const uploadedLogo = logoFile
      ? await persistWebExperienceUpload(logoFile)
      : undefined;
    const uploadedScreenshots =
      screenshotFiles.length > 0
        ? await Promise.all(
            screenshotFiles.map((file) => persistWebExperienceUpload(file)),
          )
        : undefined;

    let saved = await saveWebExperienceEditorValue(merged, new Date(), source);
    const savedValue = toWebExperienceEditorValue(saved);
    const requestedEntryId = parsedForm.kind === "entry" ? parsedForm.id : 0;
    const selectedEntry =
      parsedForm.kind === "entry"
        ? resolveSavedEntry(savedValue.entries, requestedEntryId)
        : null;

    if (parsedForm.kind === "entry" && selectedEntry) {
      const shouldUpdateMedia =
        removeLogo ||
        removeImageIds.length > 0 ||
        uploadedLogo !== undefined ||
        uploadedScreenshots !== undefined;

      if (shouldUpdateMedia) {
        const originalEntry =
          source.data.data?.[0]?.attributes.rich_links?.data?.find(
            (entry) => entry.id === selectedEntry.id,
          );

        saved = applyWebExperienceMediaPatch(saved, {
          entryId: selectedEntry.id,
          removeLogo,
          logo: uploadedLogo,
          removeImageIds,
          images: uploadedScreenshots,
        });

        await writeWebExperienceFile(saved);

        const deleteTargets = [
          ...(removeLogo || uploadedLogo !== undefined
            ? [originalEntry?.attributes.logo.data?.attributes.url]
            : []),
          ...(removeImageIds.length > 0
            ? (originalEntry?.attributes.image.data ?? [])
                .filter((image) => removeImageIds.includes(image.id))
                .map((image) => image?.attributes.url)
            : []),
        ].filter((url): url is string => Boolean(url));

        await Promise.all(
          deleteTargets.map((url) => deleteWebExperienceMedia(url)),
        );

        // `saved` was already written above and nothing downstream re-reads
        // `savedValue`, so there is no re-derivation to assign here.
      }
    }

    const targetPath = redirectTo
      ? redirectTo
      : parsedForm.kind === "intro"
        ? webExperienceEditorPath({ kind: "intro" })
        : (() => {
            const selected = selectedEntry;

            if (!selected) {
              throw error(404, "Saved web experience entry not found.");
            }

            return webExperienceEditorPath(
              { kind: "entry", id: selected.id },
              selected.title,
            );
          })();

    throw redirect(303, `${targetPath}?saved=1`);
  },
  delete: async ({ cookies, request }) => {
    requireEditorAccess(cookies);

    const source = await readWebExperienceFile();
    const current = toWebExperienceEditorValue(source);
    const formData = await request.formData();
    const parsedForm = parseWebExperienceForm(formData);

    if (parsedForm.kind !== "entry") {
      return fail(400, {
        action: "delete",
        message: "Only saved entries can be deleted.",
      });
    }

    if (parsedForm.id <= 0 || !Number.isInteger(parsedForm.id)) {
      return fail(400, {
        action: "delete",
        message: "Please select a saved entry before deleting.",
      });
    }

    if (!current.entries.some((entry) => entry.id === parsedForm.id)) {
      throw error(404, "Web experience entry not found.");
    }

    const updated = await deleteWebExperienceEntry(
      parsedForm.id,
      new Date(),
      source,
    );
    const remaining = toWebExperienceEditorValue(updated).entries[0];
    const destination = remaining
      ? webExperienceEditorPath(
          { kind: "entry", id: remaining.id },
          remaining.title,
        )
      : webExperienceEditorPath({ kind: "intro" });

    throw redirect(303, `${destination}?deleted=1`);
  },
  /**
   * Put one entry back out of a saved version.
   *
   * What this refuses is spelled out here rather than left to the seam: a version number that is not a whole
   * number, a tier that is not one of the three, an entry id that is not a whole number, and - because
   * `parsePositiveInteger` refuses a leading zero - `0` itself, never renamed to something the seam would
   * swallow.
   */
  restore: async ({ cookies, request, url }) => {
    requireEditorAccess(cookies);

    const formData = await request.formData();
    const scope = parseRestoreScope(
      getFormDataString(formData, "scope").trim(),
    );
    const timestamp = parsePositiveInteger(
      getFormDataString(formData, "timestamp").trim(),
    );
    const entryId = parsePositiveInteger(
      getFormDataString(formData, "entryId").trim(),
    );
    // `draftVersion` is carried through this form and never used: it is T9's placeholder.

    if (scope === null || timestamp === null || entryId === null) {
      throw redirect(303, `${url.pathname}?restore-failed=1`);
    }

    const restored = await attemptWebExperienceRestore({
      scope,
      timestamp,
      entryId,
    });

    if (!restored.ok) {
      throw redirect(303, `${url.pathname}?restore-failed=1`);
    }

    const heldEntry = toWebExperienceEditorValue(restored.file).entries.find(
      (entry) => entry.id === entryId,
    );

    if (!heldEntry) {
      throw error(500, "Restored web experience entry not found.");
    }

    throw redirect(
      303,
      `${webExperienceEditorPath(
        { kind: "entry", id: heldEntry.id },
        heldEntry.title,
      )}?restored=${timestamp}&entry=${entryId}&scope=${scope}`,
    );
  },
};
