import { getFormDataString } from "$lib/form-data";

import type {
  SouljuicerEditorEntry,
  SouljuicerEditorValue,
} from "./souljuicer";

export const souljuicerEditorPath = (entryId: number) =>
  `/the-souljuicer/edit/${entryId}`;

export const parseSouljuicerEditorParam = (param?: string) => {
  if (!param) {
    return null;
  }

  const [segment] = param.split("/");
  const entryId = Number(segment);

  return Number.isInteger(entryId) && entryId > 0 ? entryId : null;
};

export const parseSouljuicerForm = (formData: FormData) => {
  const rawSortOrder = formData.get("sortOrder");

  return {
    id: Number(getFormDataString(formData, "id") || "0"),
    title: getFormDataString(formData, "title"),
    createdDate: getFormDataString(formData, "createdDate"),
    medium: getFormDataString(formData, "medium"),
    description: getFormDataString(formData, "description"),
    sortOrder:
      typeof rawSortOrder === "string" && rawSortOrder.trim() !== ""
        ? Number(rawSortOrder)
        : Number.NaN,
  };
};

export const mergeSouljuicerEntry = (
  current: SouljuicerEditorValue,
  formValue: ReturnType<typeof parseSouljuicerForm>,
): SouljuicerEditorValue => ({
  ...current,
  entries: current.entries.map((entry) =>
    entry.id === formValue.id
      ? ({
          ...entry,
          title: formValue.title,
          createdDate: formValue.createdDate,
          medium: formValue.medium,
          description: formValue.description,
          sortOrder: formValue.sortOrder,
        } satisfies SouljuicerEditorEntry)
      : entry,
  ),
});

export const selectSouljuicerEntry = (
  entries: ReadonlyArray<SouljuicerEditorEntry>,
  entryId: number,
) => entries.find((entry) => entry.id === entryId) ?? null;