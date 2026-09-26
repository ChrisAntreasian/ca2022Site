import { error, fail, redirect } from "@sveltejs/kit";

import {
  isEditorEnabled,
  requireEditorEnabled,
} from "$lib/editing/auth.server";
import { getFormDataString } from "$lib/form-data";
import {
  mergeQuintuplapusEntry,
  parseQuintuplapusEditorParam,
  parseQuintuplapusForm,
  quintuplapusEditorPath,
  selectQuintuplapusEntry,
} from "$lib/editing/quintuplapus-editor";
import { toQuintuplapusEditorValue } from "$lib/editing/quintuplapus";
import {
  deleteQuintuplapusEntry,
  ensureQuintuplapusBaselineSnapshot,
  persistQuintuplapusUpload,
  readQuintuplapusFile,
  replaceQuintuplapusEntryImage,
  saveQuintuplapusEditorValue,
} from "$lib/editing/quintuplapus.server";

import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, url }) => {
  requireEditorEnabled();

  const file = await readQuintuplapusFile();
  await ensureQuintuplapusBaselineSnapshot(file);
  const value = toQuintuplapusEditorValue(file);
  const fallbackEntryId = value.entries[0]?.id ?? 0;
  const parsedEntryId = parseQuintuplapusEditorParam(params.aid);
  const entryId = parsedEntryId ?? fallbackEntryId;
  const selectedEntry = selectQuintuplapusEntry(value.entries, entryId);

  if (!selectedEntry) {
    throw error(404, "Quintuplapus entry not found.");
  }

  const status =
    url.searchParams.get("deleted") === "1"
      ? ({ title: "Quintuplapus entry deleted", message: "Quintuplapus entry deleted." } as const)
      : url.searchParams.get("saved") === "1"
        ? ({ title: "Quintuplapus entry saved", message: "Quintuplapus entry saved." } as const)
        : null;

  return {
    editorEnabled: isEditorEnabled(),
    savedTitle: status?.title ?? null,
    savedMessage: status?.message ?? null,
    editor: {
      key: "the-quintuplapus",
      label: "The Quintuplapus",
    },
    categoryTitle: value.categoryTitle,
    entries: value.entries,
    selectedEntry,
  };
};

export const actions: Actions = {
  save: async ({ request }) => {
    requireEditorEnabled();

    const file = await readQuintuplapusFile();
    const current = toQuintuplapusEditorValue(file);
    const formData = await request.formData();
    const formValue = parseQuintuplapusForm(formData);
    const redirectTo = getFormDataString(formData, "redirectTo").trim();
    const candidate = mergeQuintuplapusEntry(current, formValue);

    if (
      !candidate.categoryTitle.trim() ||
      candidate.entries.some(
        (entry) =>
          !entry.title.trim() ||
          !entry.description.trim() ||
          !entry.createdDate.trim() ||
          !entry.medium.trim() ||
          Number.isNaN(entry.sortOrder),
      )
    ) {
      return fail(400, {
        action: "save",
        message:
          "Please provide category title, entry title, description, created date, medium, and numeric sort order.",
        values: {
          ...selectQuintuplapusEntry(candidate.entries, formValue.id),
          categoryTitle: candidate.categoryTitle,
        },
      });
    }

    let saved = await saveQuintuplapusEditorValue(candidate, new Date(), file);

    const imageRaw = formData.get("imageFile");
    const imageFile =
      imageRaw instanceof File && imageRaw.size > 0 ? imageRaw : null;

    if (imageFile) {
      const uploaded = await persistQuintuplapusUpload(imageFile);
      saved = await replaceQuintuplapusEntryImage(saved, formValue.id, uploaded);
    }

    const destination =
      redirectTo || quintuplapusEditorPath(formValue.id, formValue.title);

    throw redirect(303, `${destination}?saved=1`);
  },
  delete: async ({ request }) => {
    requireEditorEnabled();

    const source = await readQuintuplapusFile();
    const current = toQuintuplapusEditorValue(source);
    const formData = await request.formData();
    const entryId = Number(getFormDataString(formData, "id") || "0");

    if (!Number.isInteger(entryId) || entryId <= 0) {
      return fail(400, {
        action: "delete",
        message: "Please select a saved entry before deleting.",
      });
    }

    if (!current.entries.some((entry) => entry.id === entryId)) {
      throw error(404, "Quintuplapus entry not found.");
    }

    if (current.entries.length <= 1) {
      return fail(400, {
        action: "delete",
        message: "The final Quintuplapus entry cannot be deleted.",
      });
    }

    const updated = await deleteQuintuplapusEntry(entryId, new Date(), source);
    const nextEntry = toQuintuplapusEditorValue(updated).entries[0];

    if (!nextEntry) {
      throw error(500, "No Quintuplapus entries remain after delete.");
    }

    throw redirect(303, `${quintuplapusEditorPath(nextEntry.id, nextEntry.title)}?deleted=1`);
  },
};