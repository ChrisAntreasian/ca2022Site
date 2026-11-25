import { error, fail, isHttpError, redirect } from "@sveltejs/kit";
import { Result, Schema } from "effect";

import {
  isEditorUnlockedForRequest,
  requireEditorAccess,
} from "#lib/editing/core/session.server";
import {
  poemEditorDefinition,
  toPoemEditorValues,
  type PoemEditorValue,
  type PoemsFile,
} from "#lib/editing/resources/poems/poems";
import {
  deletePoemEditorValue,
  ensurePoemsBaselineSnapshot,
  listPoemEditorHistoryVersions,
  readPoemEditorSnapshotEntries,
  readPoemsFile,
  releasePoemsFile,
  restorePoemEditorEntryFromSnapshot,
  savePoemEditorValue,
  type RestorePoemEditorEntryParams,
} from "#lib/editing/resources/poems/poems.server";
import {
  parsePoemEditorParam,
  parsePoemForm,
  poemEditorPath,
  selectPoem,
} from "#lib/editing/resources/poems/poems-editor";
import { getFormDataString } from "#lib/form-data";
import { isReleasable } from "#lib/content.server";

import type { SnapshotScope } from "#lib/dataStore.server";
import type { Actions, PageServerLoad } from "./$types";

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
 * layout the 61 local snapshots live in: those copies are restorable but have never been published, so they
 * get a name that says where they came from rather than a tier word an editor would have to look up.
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
 * `Intl` formatter says one thing in a browser set to en-US, another in one set to de-DE, and a third thing
 * on the server that builds the status line - and a version the page names in one set of words and the
 * status line in another is exactly the confusion this line exists to remove. UTC because the number a
 * version is named after is a UTC millisecond value.
 */
const formatVersionLabel = (timestamp: number): string => {
  const stamp = new Date(timestamp);

  return `${stamp.getUTCDate()} ${MONTH_NAMES[stamp.getUTCMonth()]} ${stamp.getUTCFullYear()} at ${String(
    stamp.getUTCHours(),
  ).padStart(2, "0")}:${String(stamp.getUTCMinutes()).padStart(2, "0")}`;
};

/** The words a refusal is said in, whichever of the four ways it failed. */
const RESTORE_REFUSAL_MESSAGE =
  "Nothing was restored: that version could not be read, or no longer holds that poem. Your current draft is unchanged.";

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
  /** Whether the current draft still holds this poem (`will replace`) or lost it (`will bring back`). */
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
 * the seam inside a `try` whose `catch` throws a redirect would let a redirect catch its own page. So the
 * seam's own failures are collected here and the action decides what the editor is told.
 *
 * What the seam dressed itself - a version that is not held in that tier, or a saved copy that is not a poems
 * file - arrives as an HTTP error and is reported to the editor without a log, because the seam already named
 * it. Everything else is written to the log first: an unreachable bucket, a draft that has never been
 * written, a version that never held the poem. "Nothing was restored" is not an explanation of a store that
 * is down, and this page is not allowed to call an outage a missing version.
 */
const attemptPoemRestore = async (
  params: RestorePoemEditorEntryParams,
): Promise<{ ok: true; file: PoemsFile } | { ok: false }> => {
  try {
    return { ok: true, file: await restorePoemEditorEntryFromSnapshot(params) };
  } catch (err) {
    if (!isHttpError(err)) {
      console.error(`poems restore: ${params.scope} version refused`, err);
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
  poems,
  draftVersion,
}: {
  url: URL;
  poems: ReadonlyArray<PoemEditorValue>;
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
    ...(await listPoemEditorHistoryVersions(MAX_RESTORE_VERSIONS)),
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
    const snapshotEntries = await readPoemEditorSnapshotEntries(
      scope,
      timestamp,
    );
    const currentIds = new Set(poems.map((poem) => poem.id));

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
      console.error(`poems restore: could not read ${scope} version`, err);
    }

    panel.note = RESTORE_READ_NOTE;

    return panel;
  }
};

/**
 * The line the editor shows after an action - the four the editor already had, plus the two a restore builds.
 *
 * The restore statuses are checked last so an editor URL that meant something before this page could restore
 * still means the same thing.
 */
const buildEditorStatus = (
  url: URL,
  poems: ReadonlyArray<PoemEditorValue>,
): EditorStatus | null => {
  if (url.searchParams.get("deleted") === "1") {
    return { title: "Poem deleted", message: "Poem deleted." };
  }

  if (url.searchParams.get("saved") === "1") {
    return { title: "Poem saved", message: "Poem saved." };
  }

  const released = url.searchParams.get("released");

  if (released) {
    return {
      title: "Poems released",
      message: `The working draft was published to live (version ${released}).`,
    };
  }

  if (url.searchParams.has("restore-failed")) {
    return { title: "Nothing restored", message: RESTORE_REFUSAL_MESSAGE };
  }

  return buildRestoreStatus(url, poems);
};

/**
 * The success line: which poem, and which version it came back out of. A line that only said "saved" would
 * leave an editor guessing which of the versions they were offered the poem came from.
 *
 * A `?restored` this function cannot read (a hand-edited link) says nothing at all rather than claiming
 * nothing happened: it cannot tell the difference between a restore that just worked and an old link somebody
 * pasted again.
 */
const buildRestoreStatus = (
  url: URL,
  poems: ReadonlyArray<PoemEditorValue>,
): EditorStatus | null => {
  const rawTimestamp = url.searchParams.get("restored");

  if (rawTimestamp === null) return null;

  const timestamp = parsePositiveInteger(rawTimestamp);
  const entryId = parsePositiveInteger(url.searchParams.get("entry"));

  if (timestamp === null || entryId === null) return null;

  const scope = parseRestoreScope(url.searchParams.get("scope"));
  const title = poems.find((poem) => poem.id === entryId)?.title?.trim();
  const tier = scope === null ? "" : ` ${tierLabel(scope)}`;

  return {
    title: "Restore complete",
    message: `Restored ${
      title ? `"${title}"` : "a poem"
    } from the version saved ${formatVersionLabel(timestamp)}${tier}.`,
  };
};

export const load: PageServerLoad = async ({ cookies, params, url }) => {
  requireEditorAccess(cookies);

  const poemsFile = await readPoemsFile();
  await ensurePoemsBaselineSnapshot(poemsFile);
  const poems = toPoemEditorValues(poemsFile);
  const fallbackPoemId = poems[0]?.id ?? 0;
  const parsedPoemId = params.pid ? parsePoemEditorParam(params.pid) : null;
  const poemId = parsedPoemId ?? fallbackPoemId;

  if (parsedPoemId === null && params.pid) {
    throw error(404, "Poem editor route not found.");
  }

  const selectedPoem = selectPoem(
    poems,
    poemId,
    poemEditorDefinition.createDefault,
  );

  if (!selectedPoem) {
    throw error(404, "Poem not found.");
  }

  const status = buildEditorStatus(url, poems);
  const restore = await buildRestorePanel({
    url,
    poems,
    draftVersion: poemsFile.timestamp,
  });

  return {
    editorEnabled: isEditorUnlockedForRequest(cookies),
    savedTitle: status?.title ?? null,
    savedMessage: status?.message ?? null,
    // Drives whether the release control appears at all, so the UI cannot offer an action the guard on
    // the server side would reject.
    releaseAvailable: isReleasable("poems"),
    restore,
    editor: {
      key: poemEditorDefinition.key,
      label: poemEditorDefinition.label,
      fields: poemEditorDefinition.fields,
      newPath: poemEditorPath("new"),
    },
    poems,
    selectedPoem,
  };
};

export const actions: Actions = {
  save: async ({ cookies, request }) => {
    requireEditorAccess(cookies);

    const formData = await request.formData();
    const candidate = parsePoemForm(formData);
    const redirectTo = getFormDataString(formData, "redirectTo").trim();
    const decoded = Schema.decodeUnknownResult(poemEditorDefinition.schema)(
      candidate,
    );

    if (Result.isFailure(decoded)) {
      return fail(400, {
        action: "save",
        message: "Please provide a title, body, and numeric sort order.",
        values: candidate,
      });
    }

    const poem = decoded.success;
    const file = await savePoemEditorValue(poem);
    const savedItems = file.data.data ?? [];
    const savedId =
      poem.id > 0 ? poem.id : Math.max(...savedItems.map((item) => item.id));
    const savedItem = savedItems.find((item) => item.id === savedId);
    const destination =
      redirectTo ||
      poemEditorPath(savedId, savedItem?.attributes.title ?? poem.title);

    throw redirect(303, `${destination}?saved=1`);
  },
  delete: async ({ cookies, request }) => {
    requireEditorAccess(cookies);

    const formData = await request.formData();
    const poemId = Number(getFormDataString(formData, "id") || "0");

    if (!Number.isInteger(poemId) || poemId <= 0) {
      return fail(400, {
        action: "delete",
        message: "Please select a saved poem before deleting.",
      });
    }

    const source = await readPoemsFile();
    const poems = toPoemEditorValues(source);

    if (!poems.some((poem) => poem.id === poemId)) {
      throw error(404, "Poem not found.");
    }

    const updated = await deletePoemEditorValue(poemId, new Date(), source);
    const remaining = toPoemEditorValues(updated);
    const nextPoem = remaining[0];
    const destination = nextPoem
      ? poemEditorPath(nextPoem.id, nextPoem.title)
      : poemEditorPath("new");

    throw redirect(303, `${destination}?deleted=1`);
  },
  /**
   * Restore one poem out of one saved version, by name.
   *
   * Everything the picker posted is checked before the seam is reached: a tier that is not one of the three,
   * a version number that is not a whole number of milliseconds, and an entry id that is not one either are
   * refused without asking the store for anything - which also means nothing is written, because the seam is
   * the only thing here that writes. The seam then protects the current draft itself, so the draft the picker
   * was reading when the form was opened is filed before it is written over.
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

    const restored = await attemptPoemRestore({
      scope,
      timestamp,
      poemId: entryId,
    });

    if (!restored.ok) {
      throw redirect(303, `${url.pathname}?restore-failed=1`);
    }

    const restoredItem = (restored.file.data.data ?? []).find(
      (item) => item.id === entryId,
    );
    const restoredTitle = restoredItem?.attributes.title?.trim();
    const destination = restoredTitle
      ? poemEditorPath(entryId, restoredTitle)
      : poemEditorPath(entryId);

    throw redirect(
      303,
      `${destination}?restored=${timestamp}&entry=${entryId}&scope=${scope}`,
    );
  },
  /**
   * Publish the working draft to live. Availability is checked before attempting anything, so while live
   * content is still on disk this reports that releases are not open yet instead of failing obscurely —
   * the route is reachable any time `ENABLE_CONTENT_EDITOR` is on, and a release once live content lives
   * in S3 mutates durable storage.
   */
  release: async ({ cookies }) => {
    requireEditorAccess(cookies);

    if (!isReleasable("poems")) {
      return fail(400, {
        action: "release",
        message:
          "Releases are not available yet: live content is still bundled. Set CONTENT_LIVE_SOURCE=s3 once the data has been seeded.",
      });
    }

    const timestamp = await releasePoemsFile();

    throw redirect(303, `/poems?released=${timestamp}`);
  },
};
