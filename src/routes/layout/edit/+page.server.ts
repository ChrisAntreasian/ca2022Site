import { fail, isHttpError, redirect } from "@sveltejs/kit";
import { Result, Schema } from "effect";

import {
  isEditorUnlockedForRequest,
  requireEditorAccess,
} from "#lib/editing/core/session.server";
import {
  layoutEditorDefinition,
  toLayoutEditorValue,
  type LayoutEditorValue,
  type LayoutFile,
} from "#lib/editing/resources/layout/layout";
import {
  layoutEditorPath,
  parseLayoutForm,
} from "#lib/editing/resources/layout/layout-editor";
import {
  ensureLayoutBaselineSnapshot,
  listLayoutEditorHistoryVersions,
  readLayoutEditorSnapshotRecord,
  readLayoutFile,
  restoreLayoutRecordFromSnapshot,
  saveLayoutEditorValue,
  type RestoreLayoutRecordParams,
} from "#lib/editing/resources/layout/layout.server";

import type { SnapshotScope } from "#lib/dataStore.server";
import { getFormDataString } from "#lib/form-data";

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
 * layout this key's genuinely edited versions live in: those copies are restorable but have never been
 * published, so they get a name that says where they came from rather than a tier word an editor would have
 * to look up.
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

const tierLabel = (scope: SnapshotScope) => TIER_LABELS[scope];

/** The header records one layout file holds - for this key, always at most one, and the count says so. */
const headersIn = (file: LayoutFile): LayoutFile["data"]["data"] =>
  file.data.data ?? [];

const quotedTitle = (title: string): string =>
  title.trim() === "" ? "no title in this version" : `"${title.trim()}"`;

/** The words a refusal is said in, whichever of the ways it failed. */
const RESTORE_REFUSAL_MESSAGE =
  "Nothing was restored: that version of the site layout could not be read. Your current site layout draft is unchanged.";

const RESTORE_READ_NOTE =
  "That version could not be read. Pick a version from the list below - nothing has been written to your draft.";

const RESTORE_NAME_NOTE =
  "A version to restore must be named by a timestamp and one of draft, live or legacy. Pick a version from the list below.";

type RestoreVersionItem = {
  timestamp: number;
  scope: SnapshotScope;
  dateLabel: string;
  tierLabel: string;
  href: string;
};

/** One field of the header this version's record holds, named in the editor's own words. */
type RestoreRecordLine = {
  label: string;
  value: string;
};

type RestoreRecordTarget = {
  timestamp: number;
  scope: SnapshotScope;
  dateLabel: string;
  tierLabel: string;
  items: RestoreRecordLine[];
  /** What this version's header compares to the one under edit now, both counts measured here. */
  comparison: string;
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
  /** The whole header record step 2 offers a restore of, or `null` while the picker is on step 1. */
  record: RestoreRecordTarget | null;
};

type EditorStatus = { title: string; message: string };

/**
 * The restore seam's outcome, kept as a value instead of an exception.
 *
 * A refusal has to reach the editor as `?restore-failed=1`, and a redirect is itself a thrown value: reading
 * the seam inside a `try` whose `catch` throws a redirect would let a redirect catch its own page. So the
 * seam's own failures are collected here and the action decides what the editor is told.
 *
 * What the seam dressed itself - a version that is not held in that tier, or a saved copy that is not a layout
 * file - arrives as an HTTP error and is reported to the editor without a log, because the seam already named
 * it. Everything else is written to the log first: an unreachable bucket, a disk that is not mounted. "Nothing
 * was restored" is not an explanation of a store that is down, and this page is not allowed to call an outage
 * a missing version.
 */
const attemptLayoutRestore = async (
  params: RestoreLayoutRecordParams,
): Promise<{ ok: true; file: LayoutFile } | { ok: false }> => {
  try {
    return { ok: true, file: await restoreLayoutRecordFromSnapshot(params) };
  } catch (err) {
    if (!isHttpError(err)) {
      console.error(`layout restore: ${params.scope} version refused`, err);
    }

    return { ok: false };
  }
};

/**
 * What one version's header record holds, field by field.
 *
 * `layout` edits two things - the header title and the logo url - and a whole-record restore replaces both,
 * so the confirm step names both rather than gesturing at "the layout". A version that holds no header entry
 * at all lists nothing, and the comparison says what restoring into it means.
 */
const recordLines = (file: LayoutFile): RestoreRecordLine[] => {
  const entry = file.data.data?.[0];

  if (!entry) return [];

  return [
    { label: "Header title", value: quotedTitle(entry.attributes.title) },
    {
      label: "Logo",
      value:
        entry.attributes.image?.data?.attributes?.url?.trim() ||
        "no logo url in this version",
    },
  ];
};

/**
 * The restore picker's data, built from the URL alone.
 *
 * Two steps: `?restore=1` asks for the version list, and `?restore=1` with a timestamp and a tier asks for one
 * version's whole header record. Only one of them is ever asked for, and the ordinary editor view - no
 * `?restore` at all - pays for no history read whatsoever.
 */
const buildRestorePanel = async ({
  url,
  currentFile,
  draftVersion,
}: {
  url: URL;
  currentFile: LayoutFile;
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
    record: null,
  };

  // `?restore` is a sentinel meaning "this dialog is open", and its value is never read. Every control that
  // opens it writes `?restore=1`, so parsing the value as a version number is how a timestamp from 1970 would
  // arrive at a store - which is why the versions step 2 is named by its own `restoreVersion` parameter.
  if (!url.searchParams.has("restore")) return panel;

  panel.open = true;

  panel.versions = [
    ...(await listLayoutEditorHistoryVersions(MAX_RESTORE_VERSIONS)),
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
    const snapshot = await readLayoutEditorSnapshotRecord(scope, timestamp);
    const heldCount = headersIn(snapshot).length;
    const currentCount = headersIn(currentFile).length;

    panel.record = {
      timestamp,
      scope,
      dateLabel: formatVersionLabel(timestamp),
      tierLabel: tierLabel(scope),
      items: recordLines(snapshot),
      // Both counts are measured out of the two records themselves: this version's header entries, and the
      // draft's. A header record this version does not hold is not promised as a restoration.
      comparison:
        `Restoring brings the site layout back to the version saved ` +
        `${formatVersionLabel(timestamp)} ${tierLabel(scope)}, which held ` +
        `${heldCount} header record${heldCount === 1 ? "" : "s"}. The site layout ` +
        `you are editing now holds ${currentCount} header record${currentCount === 1 ? "" : "s"}, ` +
        `and ${currentCount === 1 ? "it" : "each of them"} is replaced whole - header title ` +
        `and logo both.`,
    };

    return panel;
  } catch (err) {
    if (!isHttpError(err)) {
      console.error(`layout restore: could not read ${scope} version`, err);
    }

    panel.note = RESTORE_READ_NOTE;

    return panel;
  }
};

/**
 * The line the editor shows after an action - the one this page already had, plus the two a restore builds.
 *
 * The restore statuses are checked last so an editor URL that meant something before this page could restore
 * still means the same thing.
 */
const buildEditorStatus = (
  url: URL,
  layout: LayoutEditorValue,
): EditorStatus | null => {
  if (url.searchParams.get("saved") === "1") {
    return { title: "Layout saved", message: "Site layout saved." };
  }

  if (url.searchParams.has("restore-failed")) {
    return {
      title: "Nothing restored",
      message: RESTORE_REFUSAL_MESSAGE,
    };
  }

  return buildRestoreStatus(url, layout);
};

/**
 * The success line: which record came back, and which version it came out of.
 *
 * A `?restored` this function cannot read (a hand-edited link) says nothing at all rather than claiming
 * nothing happened: it cannot tell the difference between a restore that just worked and an old link somebody
 * pasted again.
 */
const buildRestoreStatus = (
  url: URL,
  layout: LayoutEditorValue,
): EditorStatus | null => {
  const rawTimestamp = url.searchParams.get("restored");

  if (rawTimestamp === null) return null;

  const timestamp = parsePositiveInteger(rawTimestamp);

  if (timestamp === null) return null;

  const scope = parseRestoreScope(url.searchParams.get("scope"));
  const tier = scope === null ? "" : ` ${tierLabel(scope)}`;
  const title = layout.title.trim();
  const named =
    title === "" ? "the site layout" : `the site layout ("${title}")`;

  return {
    title: "Restore complete",
    message: `Restored ${named} - header title and logo, whole record - from the version saved ${formatVersionLabel(timestamp)}${tier}.`,
  };
};

export const load: PageServerLoad = async ({ cookies, url }) => {
  requireEditorAccess(cookies);

  const file = await readLayoutFile();
  await ensureLayoutBaselineSnapshot(file);
  const layout = toLayoutEditorValue(file);

  const status = buildEditorStatus(url, layout);
  const restore = await buildRestorePanel({
    url,
    currentFile: file,
    draftVersion: file.timestamp,
  });

  return {
    editorEnabled: isEditorUnlockedForRequest(cookies),
    savedTitle: status?.title ?? null,
    savedMessage: status?.message ?? null,
    restore,
    editor: {
      key: layoutEditorDefinition.key,
      label: layoutEditorDefinition.label,
      path: layoutEditorPath(),
    },
    layout,
  };
};

export const actions: Actions = {
  save: async ({ cookies, request }) => {
    requireEditorAccess(cookies);

    const formData = await request.formData();
    const candidate = parseLayoutForm(formData);
    const decoded = Schema.decodeUnknownResult(layoutEditorDefinition.schema)(
      candidate,
    );

    if (Result.isFailure(decoded) || !candidate.title.trim()) {
      return fail(400, {
        action: "save",
        message: "Please provide a header title before saving.",
        values: candidate,
      });
    }

    await saveLayoutEditorValue(decoded.success);

    throw redirect(303, `${layoutEditorPath()}?saved=1`);
  },
  /**
   * Restore the whole site layout record out of one saved version.
   *
   * There is one header in this record and the editor edits it as one thing, so there is nothing for a
   * per-entry restore to single out: `layout` has no entry list, no entry id in its editor value, and no
   * merge rule of its own - it is the card's whole-record case, and the confirm step names what is replaced.
   *
   * Everything the picker posted is checked before the seam is reached: a tier that is not one of the three
   * and a version number that is not a whole number of milliseconds are refused without asking the store for
   * anything - which also means nothing is written, because the seam is the only thing here that writes. The
   * seam then protects the current draft itself, so the header the picker was reading when the form was opened
   * is filed in history before it is written over.
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
    // `draftVersion` is carried through this form and never used: it is T9's placeholder.

    if (scope === null || timestamp === null) {
      throw redirect(303, `${url.pathname}?restore-failed=1`);
    }

    const restored = await attemptLayoutRestore({ scope, timestamp });

    if (!restored.ok) {
      throw redirect(303, `${url.pathname}?restore-failed=1`);
    }

    // A whole-record restore lands on the record's own page, which for this key is the page the editor was
    // already on - one header, one route, no entry id to land on.
    throw redirect(
      303,
      `${layoutEditorPath()}?restored=${timestamp}&scope=${scope}`,
    );
  },
};
