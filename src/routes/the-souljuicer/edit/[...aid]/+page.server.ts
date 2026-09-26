import { error, fail, redirect } from "@sveltejs/kit";

import {
  isEditorEnabled,
  requireEditorEnabled,
} from "$lib/editing/core/auth.server";
import { getFormDataString } from "$lib/form-data";
import {
  mergeSouljuicerEntry,
  parseSouljuicerEditorParam,
  parseSouljuicerForm,
  selectSouljuicerEntry,
  souljuicerEditorPath,
} from "$lib/editing/resources/souljuicer/souljuicer-editor";
import { toSouljuicerEditorValue } from "$lib/editing/resources/souljuicer/souljuicer";
import {
  deleteSouljuicerEntry,
  ensureSouljuicerBaselineSnapshot,
  persistSouljuicerUpload,
  readSouljuicerFile,
  replaceSouljuicerEntryImage,
  saveSouljuicerEditorValue,
} from "$lib/editing/resources/souljuicer/souljuicer.server";

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

  const status =
    url.searchParams.get("deleted") === "1"
      ? ({ title: "Souljuicer entry deleted", message: "Souljuicer entry deleted." } as const)
      : url.searchParams.get("saved") === "1"
        ? ({ title: "Souljuicer entry saved", message: "Souljuicer entry saved." } as const)
        : null;

  return {
    editorEnabled: isEditorEnabled(),
    savedTitle: status?.title ?? null,
    savedMessage: status?.message ?? null,
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

    const saved = await saveSouljuicerEditorValue(candidate, new Date(), file);

    const imageRaw = formData.get("imageFile");
    const imageFile =
      imageRaw instanceof File && imageRaw.size > 0 ? imageRaw : null;

    if (imageFile) {
      const uploaded = await persistSouljuicerUpload(imageFile);
      await replaceSouljuicerEntryImage(saved, formValue.id, uploaded);
    }

    const destination =
      redirectTo || souljuicerEditorPath(formValue.id);

    throw redirect(303, `${destination}?saved=1`);
  },
  delete: async ({ request }) => {
    requireEditorEnabled();

    const source = await readSouljuicerFile();
    const current = toSouljuicerEditorValue(source);
    const formData = await request.formData();
    const entryId = Number(getFormDataString(formData, "id") || "0");

    if (!Number.isInteger(entryId) || entryId <= 0) {
      return fail(400, {
        action: "delete",
        message: "Please select a saved entry before deleting.",
      });
    }

    if (!current.entries.some((entry) => entry.id === entryId)) {
      throw error(404, "Souljuicer entry not found.");
    }

    if (current.entries.length <= 1) {
      return fail(400, {
        action: "delete",
        message: "The final Souljuicer entry cannot be deleted.",
      });
    }

    const updated = await deleteSouljuicerEntry(entryId, new Date(), source);
    const nextEntry = toSouljuicerEditorValue(updated).entries[0];

    if (!nextEntry) {
      throw error(500, "No Souljuicer entries remain after delete.");
    }

    throw redirect(303, `${souljuicerEditorPath(nextEntry.id)}?deleted=1`);
  },
};