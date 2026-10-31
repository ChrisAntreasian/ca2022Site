import { ENABLE_CONTENT_EDITOR } from "$app/env/private";

import { e403 } from "$lib/error";

export const isEditorEnabled = () =>
  ENABLE_CONTENT_EDITOR?.trim() === "true";

export const requireEditorEnabled = () => {
  if (!isEditorEnabled()) {
    throw e403("Permission denied.");
  }
};
