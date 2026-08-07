import { cleanUrlSlug } from "$lib/history";

import type {
  WebExperienceEditorValue,
  WebExperienceEntry,
  WebExperienceTarget,
} from "./web-experience";

const newWebExperienceParam = "new";

export type WebExperienceSelection =
  | { kind: "intro" }
  | { kind: "new" }
  | { kind: "entry"; id: number };

export const webExperienceEditorPath = (
  selection: WebExperienceSelection,
  title?: string,
) =>
  selection.kind === "intro"
    ? "/web-experience/edit/intro"
    : selection.kind === "new"
      ? `/web-experience/edit/${newWebExperienceParam}`
    : title
      ? `/web-experience/edit/${selection.id}/${cleanUrlSlug(title)}`
      : `/web-experience/edit/${selection.id}`;

export const parseWebExperienceEditorParam = (param: string) => {
  const [segment] = param.split("/");

  if (segment === "intro") {
    return { kind: "intro" } as const;
  }

  if (segment === newWebExperienceParam) {
    return { kind: "new" } as const;
  }

  const entryId = Number(segment);

  return Number.isInteger(entryId) && entryId > 0
    ? ({ kind: "entry", id: entryId } as const)
    : null;
};

export const selectWebExperienceTarget = (
  value: WebExperienceEditorValue,
  selection: WebExperienceSelection,
): WebExperienceTarget | null => {
  if (selection.kind === "intro") {
    return {
      kind: "intro" as const,
      title: value.introTitle,
      bodyMarkdown: value.introBodyMarkdown,
      pageTitle: value.pageTitle,
    };
  }

  if (selection.kind === "new") {
    const nextSortOrder =
      value.entries.reduce((maxOrder, entry) => Math.max(maxOrder, entry.sortOrder), 0) + 10;

    return {
      kind: "entry" as const,
      id: 0,
      title: "",
      bodyMarkdown: "",
      primaryLink: "",
      secondaryLink: null,
      sortOrder: nextSortOrder,
    };
  }

  const entry = value.entries.find((item) => item.id === selection.id);

  if (!entry) {
    return null;
  }

  return {
    kind: "entry" as const,
    ...entry,
  };
};

export const parseWebExperienceForm = (formData: FormData) => {
  const kind = String(formData.get("kind") ?? "");

  if (kind === "intro") {
    return {
      kind: "intro" as const,
      pageTitle: String(formData.get("pageTitle") ?? ""),
      introTitle: String(formData.get("introTitle") ?? ""),
      introBodyMarkdown: String(formData.get("introBodyMarkdown") ?? ""),
    };
  }

  const rawSortOrder = formData.get("sortOrder");

  return {
    kind: "entry" as const,
    id: Number(formData.get("id") ?? "0"),
    title: String(formData.get("title") ?? ""),
    bodyMarkdown: String(formData.get("bodyMarkdown") ?? ""),
    primaryLink: String(formData.get("primaryLink") ?? ""),
    secondaryLink: String(formData.get("secondaryLink") ?? "") || null,
    sortOrder:
      typeof rawSortOrder === "string" && rawSortOrder.trim() !== ""
        ? Number(rawSortOrder)
        : Number.NaN,
  };
};

export const mergeWebExperienceValue = (
  current: WebExperienceEditorValue,
  formValue: ReturnType<typeof parseWebExperienceForm>,
): WebExperienceEditorValue => {
  if (formValue.kind === "intro") {
    return {
      ...current,
      pageTitle: formValue.pageTitle,
      introTitle: formValue.introTitle,
      introBodyMarkdown: formValue.introBodyMarkdown,
    };
  }

  const updatedEntry: WebExperienceEntry = {
    id: formValue.id,
    title: formValue.title,
    bodyMarkdown: formValue.bodyMarkdown,
    primaryLink: formValue.primaryLink,
    secondaryLink: formValue.secondaryLink,
    sortOrder: formValue.sortOrder,
  };

  const index = current.entries.findIndex((entry) => entry.id === formValue.id);

  if (index < 0 || formValue.id <= 0) {
    return {
      ...current,
      entries: [...current.entries, updatedEntry],
    };
  }

  return {
    ...current,
    entries: current.entries.map((entry) =>
      entry.id === formValue.id
        ? ({ ...entry, ...updatedEntry } satisfies WebExperienceEntry)
        : entry,
    ),
  };
};
