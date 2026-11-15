import { getFormDataString } from "#lib/form-data";

import type { LandingEditorValue, LandingSection } from "./landing";

export const landingEditorPath = (sectionId: number | "new") =>
  `/landing/edit/${sectionId}`;

/** Parse the `[...sid]` route param into a section id, or null when it is not a positive integer. */
export const parseLandingEditorParam = (param: string): number | null => {
  const parsed = Number(param);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export const selectLandingSection = (
  value: LandingEditorValue,
  sectionId: number,
): LandingSection | null => {
  const section = value.sections.find(
    (candidate) => candidate.id === sectionId,
  );

  if (section) return section;

  // `new` routes to an unsaved section id of 0 so the form can offer create semantics.
  if (sectionId === 0) {
    return { id: 0, title: "", description: "", link: "" };
  }

  return null;
};

export const parseLandingSectionForm = (
  formData: FormData,
): LandingSection => ({
  id: Number(getFormDataString(formData, "id") || "0"),
  title: getFormDataString(formData, "title"),
  description: getFormDataString(formData, "description"),
  link: getFormDataString(formData, "link").trim(),
});
