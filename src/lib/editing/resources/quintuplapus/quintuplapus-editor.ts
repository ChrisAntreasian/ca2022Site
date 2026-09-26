import { cleanUrlSlug } from "$lib/history";
import { getFormDataString } from "$lib/form-data";

import type {
  QuintuplapusEditorEntry,
  QuintuplapusEditorValue,
} from "./quintuplapus";

export const quintuplapusEditorPath = (entryId: number, title?: string) =>
  title
    ? `/the-quintuplapus/edit/${entryId}/${cleanUrlSlug(title)}`
    : `/the-quintuplapus/edit/${entryId}`;

export const parseQuintuplapusEditorParam = (param?: string) => {
  if (!param) {
    return null;
  }

  const [segment] = param.split("/");
  const entryId = Number(segment);

  return Number.isInteger(entryId) && entryId > 0 ? entryId : null;
};

export const parseQuintuplapusForm = (formData: FormData) => {
  const rawSortOrder = formData.get("sortOrder");

  return {
    id: Number(getFormDataString(formData, "id") || "0"),
    categoryTitle: getFormDataString(formData, "categoryTitle"),
    title: getFormDataString(formData, "title"),
    description: getFormDataString(formData, "description"),
    createdDate: getFormDataString(formData, "createdDate"),
    medium: getFormDataString(formData, "medium"),
    sortOrder:
      typeof rawSortOrder === "string" && rawSortOrder.trim() !== ""
        ? Number(rawSortOrder)
        : Number.NaN,
  };
};

export const mergeQuintuplapusEntry = (
  current: QuintuplapusEditorValue,
  formValue: ReturnType<typeof parseQuintuplapusForm>,
): QuintuplapusEditorValue => ({
  ...current,
  categoryTitle: formValue.categoryTitle,
  entries: current.entries.map((entry) =>
    entry.id === formValue.id
      ? ({
          ...entry,
          title: formValue.title,
          description: formValue.description,
          createdDate: formValue.createdDate,
          medium: formValue.medium,
          sortOrder: formValue.sortOrder,
        } satisfies QuintuplapusEditorEntry)
      : entry,
  ),
});

export const selectQuintuplapusEntry = (
  entries: ReadonlyArray<QuintuplapusEditorEntry>,
  entryId: number,
) => entries.find((entry) => entry.id === entryId) ?? null;