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

  return {
    editorEnabled: isEditorEnabled(),
    savedMessage:
      url.searchParams.get("saved") === "1" ? "Quintuplapus entry saved." : null,
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
};