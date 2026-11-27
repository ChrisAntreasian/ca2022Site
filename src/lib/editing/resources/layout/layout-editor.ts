import { getFormDataString } from "#lib/form-data";

import type { LayoutEditorValue } from "./layout";

export const layoutEditorPath = () => "/layout/edit";

export const parseLayoutForm = (formData: FormData): LayoutEditorValue => ({
  title: getFormDataString(formData, "title"),
  logoUrl: getFormDataString(formData, "logoUrl").trim(),
});
