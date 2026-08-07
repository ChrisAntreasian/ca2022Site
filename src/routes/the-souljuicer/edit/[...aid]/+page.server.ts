import { error, fail, redirect } from "@sveltejs/kit";

import {
  isEditorEnabled,
  requireEditorEnabled,
} from "$lib/editing/auth.server";
import { getFormDataString } from "$lib/form-data";
import {
  mergeSouljuicerEntry,
  parseSouljuicerEditorParam,
  parseSouljuicerForm,
  selectSouljuicerEntry,
  souljuicerEditorPath,
} from "$lib/editing/souljuicer-editor";
import { toSouljuicerEditorValue } from "$lib/editing/souljuicer";
import {
  ensureSouljuicerBaselineSnapshot,
  persistSouljuicerUpload,
  readSouljuicerFile,
  replaceSouljuicerEntryImage,
  saveSouljuicerEditorValue,
} from "$lib/editing/souljuicer.server";

import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, url }) => {
  requireEditorEnabled();

  const file = await readSouljuicerFile();
  await ensureSouljuicerBaselineSnapshot(file);
  const value = toSouljuicerEditorValue(file);
  const fallbackEntryId = value.entries[0]?.id ?? 0;
  const parsedEntryId = parseSouljuicerEditorParam(params.aid);
  const entryId = parsedEntryId ?? fallbackEntryId;
  const selectedEntry = selectSouljuicerEntry(value.entries, entryId);

  if (!selectedEntry) {
    throw error(404, "Souljuicer entry not found.");
  }

  return {
    editorEnabled: isEditorEnabled(),
    savedMessage:
      url.searchParams.get("saved") === "1" ? "Souljuicer entry saved." : null,
    editor: {
      key: "the-souljuicer",
      label: "The SoulJuicer",
    },
    entries: value.entries,
    selectedEntry,
  };
};

export const actions: Actions = {
  save: async ({ request }) => {
    requireEditorEnabled();

    const file = await readSouljuicerFile();
    const current = toSouljuicerEditorValue(file);
    const formData = await request.formData();
    const formValue = parseSouljuicerForm(formData);
    const redirectTo = getFormDataString(formData, "redirectTo").trim();
    const candidate = mergeSouljuicerEntry(current, formValue);

    if (
      candidate.entries.some(
        (entry) =>
          !entry.title.trim() ||
          !entry.createdDate.trim() ||
          !entry.medium.trim() ||
          !entry.description.trim() || Number.isNaN(entry.sortOrder),
      )
    ) {
      return fail(400, {
        action: "save",
        message:
          "Please provide title, created date, medium, description, and numeric sort order.",
        values: selectSouljuicerEntry(candidate.entries, formValue.id),
      });
    }

    let saved = await saveSouljuicerEditorValue(candidate, new Date(), file);

    const imageRaw = formData.get("imageFile");
    const imageFile =
      imageRaw instanceof File && imageRaw.size > 0 ? imageRaw : null;

    if (imageFile) {
      const uploaded = await persistSouljuicerUpload(imageFile);
      saved = await replaceSouljuicerEntryImage(saved, formValue.id, uploaded);
    }

    const destination =
      redirectTo || souljuicerEditorPath(formValue.id);

    throw redirect(303, `${destination}?saved=1`);
  },
};