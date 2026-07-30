import { env } from "$env/dynamic/private";

import { e403 } from "$lib/error";

export const isEditorEnabled = () => env.ENABLE_CONTENT_EDITOR?.trim() === "true";

export const requireEditorEnabled = () => {
  if (!isEditorEnabled()) {
    throw e403("Permission denied.");
  }
};