import { isEditorUnlockedForRequest } from "#lib/editing/core/session.server";
import { toTermsOfServiceEditorValue } from "#lib/editing/resources/terms-of-service/terms-of-service";
import { readTermsOfServiceFile } from "#lib/editing/resources/terms-of-service/terms-of-service.server";

import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ cookies }) => {
  const file = await readTermsOfServiceFile();
  const value = toTermsOfServiceEditorValue(file);

  return {
    editorEnabled: isEditorUnlockedForRequest(cookies),
    terms: {
      title: value.title,
      bodyMarkdown: value.bodyMarkdown,
    },
  };
};
