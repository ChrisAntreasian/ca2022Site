import { getFormDataString } from "$lib/form-data";

import type { TermsOfServiceEditorValue } from "./terms-of-service";

export const termsOfServiceEditorPath = () => "/terms-of-service/edit";

export const parseTermsOfServiceForm = (
  formData: FormData,
): TermsOfServiceEditorValue => ({
  title: getFormDataString(formData, "title"),
  bodyMarkdown: getFormDataString(formData, "bodyMarkdown"),
});
