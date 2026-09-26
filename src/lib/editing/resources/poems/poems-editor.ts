import { getFormDataString } from "$lib/form-data";
import { cleanUrlSlug } from "$lib/history";

import type { PoemEditorValue } from "./poems";

const newPoemParam = "new";

export const poemEditorPath = (
  poemId: number | typeof newPoemParam,
  title?: string,
) =>
  poemId === newPoemParam
    ? `/poems/edit/${poemId}`
    : title
      ? `/poems/edit/${poemId}/${cleanUrlSlug(title)}`
      : `/poems/edit/${poemId}`;

export const parsePoemEditorParam = (param: string) => {
  const [idSegment] = param.split("/");

  if (idSegment === newPoemParam) {
    return 0;
  }

  const poemId = Number(idSegment);

  return Number.isInteger(poemId) && poemId > 0 ? poemId : null;
};

export const parsePoemForm = (formData: FormData): PoemEditorValue => {
  const rawId = formData.get("id");
  const rawSortOrder = formData.get("sortOrder");

  return {
    id: typeof rawId === "string" && rawId.trim() !== "" ? Number(rawId) : 0,
    title: getFormDataString(formData, "title"),
    bodyMarkdown: getFormDataString(formData, "bodyMarkdown"),
    sortOrder:
      typeof rawSortOrder === "string" && rawSortOrder.trim() !== ""
        ? Number(rawSortOrder)
        : Number.NaN,
  };
};

export const selectPoem = (
  poems: ReadonlyArray<PoemEditorValue>,
  poemId: number,
  createDefault: () => PoemEditorValue,
) => {
  if (poemId === 0) {
    return createDefault();
  }

  return poems.find((poem) => poem.id === poemId) ?? null;
};