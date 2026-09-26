import { isEditorEnabled } from "$lib/editing/core/auth.server";
import { toTermsOfServiceEditorValue } from "$lib/editing/resources/terms-of-service/terms-of-service";
import { readTermsOfServiceFile } from "$lib/editing/resources/terms-of-service/terms-of-service.server";

import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
  const file = await readTermsOfServiceFile();
  const value = toTermsOfServiceEditorValue(file);

  return {
    editorEnabled: isEditorEnabled(),
    terms: {
      title: value.title,
      bodyMarkdown: value.bodyMarkdown,
    },
  };
};
