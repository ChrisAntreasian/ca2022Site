import { error, fail, isHttpError, redirect } from "@sveltejs/kit";
import { Result, Schema } from "effect";

import {
  isEditorUnlockedForRequest,
  requireEditorAccess,
} from "#lib/editing/core/session.server";
import {
  landingEditorDefinition,
  landingSectionC,
  toLandingEditorValue,
  type LandingEditorValue,
  type LandingFile,
  type LandingSection,
} from "#lib/editing/resources/landing/landing";
import {
  landingEditorPath,
  parseLandingEditorParam,
  parseLandingSectionForm,
  selectLandingSection,
} from "#lib/editing/resources/landing/landing-editor";
import {
  ensureLandingBaselineSnapshot,
  listLandingEditorHistoryVersions,
  readLandingEditorSnapshotRecord,
  readLandingFile,
  restoreLandingRecordFromSnapshot,
  saveLandingSectionEditorValue,
  type RestoreLandingRecordParams,
} from "#lib/editing/resources/landing/landing.server";

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
 * layout the home page's genuinely edited versions live in: those copies are restorable but have never been
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

/**
 * What the sections of one saved home page are called, in the order this record holds them.
 *
 * `landing` is edited a section at a time, and its sections carry the ids Strapi gave them - the same ids
 * every saved copy of this record repeats (measured out of two real saved copies: 5, 7, 2 and 1 in both). A
 * whole-record restore does not act on those ids, but naming the sections a version held is how the confirm
 * step shows an editor what is about to be replaced, and those names have to come out of the version rather
 * than out of the draft they are about to overwrite.
 */
const sectionsIn = (file: LandingFile) => toLandingEditorValue(file).sections;

/** The words a refusal is said in, whichever of the ways it failed. */
const RESTORE_REFUSAL_MESSAGE =
  "Nothing was restored: that version of the home page could not be read. Your current home page draft is unchanged.";

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

/** One section this version's record held, named by the id and title that record gives it. */
type RestoreRecordLine = {
  label: string;
  value: string;
};

type RestoreRecordTarget = {
  timestamp: number;
  scope: SnapshotScope;
  dateLabel: string;
  tierLabel: string;
  /** The version's own sections, listed in the order the version holds them. */
  items: RestoreRecordLine[];
  /** The plain-language comparison: this version's section count against the draft's own, both measured. */
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
  /** The whole home page record step 2 offers a restore of, or `null` while the picker is on step 1. */
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
 * What the seam dressed itself - a version that is not held in that tier, or a saved copy that is not a
 * landing file - arrives as an HTTP error and is reported to the editor without a log, because the seam
 * already named it. Everything else is written to the log first: an unreachable bucket, a disk that is not
 * mounted. "Nothing was restored" is not an explanation of a store that is down, and this page is not allowed
 * to call an outage a missing version.
 */
const attemptLandingRestore = async (
  params: RestoreLandingRecordParams,
): Promise<{ ok: true; file: LandingFile } | { ok: false }> => {
  try {
    return { ok: true, file: await restoreLandingRecordFromSnapshot(params) };
  } catch (err) {
    if (!isHttpError(err)) {
      console.error(`landing restore: ${params.scope} version refused`, err);
    }

    return { ok: false };
  }
};

/** A version's sections, named the way the picker shows them. */
const recordLines = (
  sections: ReadonlyArray<LandingSection>,
): RestoreRecordLine[] =>
  sections.map((section, index) => ({
    label: `Section ${section.id} (${index + 1} of ${sections.length})`,
    value:
      section.title.trim() === ""
        ? "no title in this version"
        : `"${section.title}"`,
  }));

/**
 * The restore picker's data, built from the URL alone.
 *
 * Two steps: `?restore=1` asks for the version list, and `?restore=1` with a timestamp and a tier asks for
 * one version's whole home page record. Only one of them is ever asked for, and the ordinary editor view - no
 * `?restore` at all - pays for no history read whatsoever.
 */
const buildRestorePanel = async ({
  url,
  landing,
  draftVersion,
}: {
  url: URL;
  landing: LandingEditorValue;
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
    ...(await listLandingEditorHistoryVersions(MAX_RESTORE_VERSIONS)),
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
    const snapshot = await readLandingEditorSnapshotRecord(scope, timestamp);
    const sections = sectionsIn(snapshot);
    const currentCount = landing.sections.length;

    panel.record = {
      timestamp,
      scope,
      dateLabel: formatVersionLabel(timestamp),
      tierLabel: tierLabel(scope),
      items: recordLines(sections),
      // Both counts are measured, not asserted: this version's own section count, and the draft's own, read
      // from the record the page is currently editing.
      comparison:
        `Restoring brings the whole home page back to the version saved ` +
        `${formatVersionLabel(timestamp)} ${tierLabel(scope)}, which held ` +
        `${sections.length} section${sections.length === 1 ? "" : "s"}. The home page you ` +
        `are editing now holds ${currentCount} section${currentCount === 1 ? "" : "s"}, and ` +
        `all ${currentCount} of them are replaced.`,
    };

    return panel;
  } catch (err) {
    if (!isHttpError(err)) {
      console.error(`landing restore: could not read ${scope} version`, err);
    }

    panel.note = RESTORE_READ_NOTE;

    return panel;
  }
};

/** The page title the restored record carries, for the line the editor is shown after it. */
const landingRecordTitle = (file: LandingFile): string => {
  const title = file.data?.data?.[0]?.attributes?.title?.trim();

  return title === undefined || title === "" ? "" : title;
};

/**
 * The line the editor shows after an action - the one this page already had, plus the two a restore builds.
 *
 * The restore statuses are checked last so an editor URL that meant something before this page could restore
 * still means the same thing.
 */
const buildEditorStatus = (
  url: URL,
  file: LandingFile,
): EditorStatus | null => {
  if (url.searchParams.get("saved") === "1") {
    return { title: "Section saved", message: "Home page section saved." };
  }

  if (url.searchParams.has("restore-failed")) {
    return {
      title: "Nothing restored",
      message: RESTORE_REFUSAL_MESSAGE,
    };
  }

  return buildRestoreStatus(url, file);
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
  file: LandingFile,
): EditorStatus | null => {
  const rawTimestamp = url.searchParams.get("restored");

  if (rawTimestamp === null) return null;

  const timestamp = parsePositiveInteger(rawTimestamp);

  if (timestamp === null) return null;

  const scope = parseRestoreScope(url.searchParams.get("scope"));
  const tier = scope === null ? "" : ` ${tierLabel(scope)}`;
  const title = landingRecordTitle(file);
  const named = title === "" ? "the home page" : `the home page ("${title}")`;

  return {
    title: "Restore complete",
    message: `Restored ${named} - whole record, every section - from the version saved ${formatVersionLabel(
      timestamp,
    )}${tier}.`,
  };
};

export const load: PageServerLoad = async ({ cookies, params, url }) => {
  requireEditorAccess(cookies);

  const file = await readLandingFile();
  await ensureLandingBaselineSnapshot(file);
  const landing = toLandingEditorValue(file);
  const fallbackSectionId = landing.sections[0]?.id ?? 0;
  const parsedSectionId = params.sid
    ? parseLandingEditorParam(params.sid)
    : null;
  const sectionId = parsedSectionId ?? fallbackSectionId;

  if (parsedSectionId === null && params.sid) {
    throw error(404, "Home page editor route not found.");
  }

  const selectedSection = selectLandingSection(landing, sectionId);

  if (!selectedSection) {
    throw error(404, "Home page section not found.");
  }

  const status = buildEditorStatus(url, file);
  const restore = await buildRestorePanel({
    url,
    landing,
    draftVersion: file.timestamp,
  });

  return {
    editorEnabled: isEditorUnlockedForRequest(cookies),
    savedTitle: status?.title ?? null,
    savedMessage: status?.message ?? null,
    restore,
    editor: {
      key: landingEditorDefinition.key,
      label: landingEditorDefinition.label,
      fields: landingEditorDefinition.fields,
    },
    landing,
    selectedSection,
  };
};

export const actions: Actions = {
  save: async ({ cookies, request }) => {
    requireEditorAccess(cookies);

    const formData = await request.formData();
    const candidate = parseLandingSectionForm(formData);
    const decoded = Schema.decodeUnknownResult(landingSectionC)(candidate);

    if (Result.isFailure(decoded) || !candidate.title.trim()) {
      return fail(400, {
        action: "save",
        message: "Please provide a section title before saving.",
        values: candidate,
      });
    }

    const section = decoded.success;
    await saveLandingSectionEditorValue(section);

    throw redirect(303, `${landingEditorPath(section.id)}?saved=1`);
  },
  /**
   * Restore the whole home page record out of one saved version.
   *
   * `landing` has no entry restore here, and this is the card's decision, not an oversight: the record's
   * sections do carry stable ids, but a restore that replaced one section at a time would have to be asked
   * for one section at a time, on a page that is showing a single section - and the home page is one record,
   * editable only as a whole. The confirm step therefore says plainly that every section is replaced.
   *
   * Everything the picker posted is checked before the seam is reached: a tier that is not one of the three
   * and a version number that is not a whole number of milliseconds are refused without asking the store for
   * anything - which also means nothing is written, because the seam is the only thing here that writes. The
   * seam then protects the current draft itself, so the record the picker was reading when the form was opened
   * is filed before it is written over.
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

    const restored = await attemptLandingRestore({ scope, timestamp });

    if (!restored.ok) {
      throw redirect(303, `${url.pathname}?restore-failed=1`);
    }

    // A whole-record restore lands on the home page editor, named by a section this restored record actually
    // holds: the section a hand-typed URL was pointing at may not be in the version that just got restored,
    // and a redirect to a section the editor no longer contains is a 404 disguised as a success.
    const landing = toLandingEditorValue(restored.file);

    throw redirect(
      303,
      `${landingEditorPath(landing.sections[0]?.id ?? 0)}?restored=${timestamp}&scope=${scope}`,
    );
  },
};
