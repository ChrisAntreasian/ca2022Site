import { fail, redirect } from "@sveltejs/kit";
import { Result, Schema } from "effect";

import {
  isEditorUnlockedForRequest,
  requireEditorAccess,
} from "#lib/editing/core/session.server";
import {
  termsOfServiceEditorDefinition,
  toTermsOfServiceEditorValue,
} from "#lib/editing/resources/terms-of-service/terms-of-service";
import {
  termsOfServiceEditorPath,
  parseTermsOfServiceForm,
} from "#lib/editing/resources/terms-of-service/terms-of-service-editor";
import {
  ensureTermsOfServiceBaselineSnapshot,
  readTermsOfServiceFile,
  saveTermsOfServiceEditorValue,
} from "#lib/editing/resources/terms-of-service/terms-of-service.server";

import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ cookies, url }) => {
  requireEditorAccess(cookies);

  const file = await readTermsOfServiceFile();
  await ensureTermsOfServiceBaselineSnapshot(file);
  const terms = toTermsOfServiceEditorValue(file);

  const status =
    url.searchParams.get("saved") === "1"
      ? ({
          title: "Terms of service saved",
          message: "Terms of service saved.",
        } as const)
      : null;

  return {
    editorEnabled: isEditorUnlockedForRequest(cookies),
    savedTitle: status?.title ?? null,
    savedMessage: status?.message ?? null,
    editor: {
      key: termsOfServiceEditorDefinition.key,
      label: termsOfServiceEditorDefinition.label,
      path: termsOfServiceEditorPath(),
    },
    terms,
  };
};

export const actions: Actions = {
  save: async ({ cookies, request }) => {
    requireEditorAccess(cookies);

    const formData = await request.formData();
    const candidate = parseTermsOfServiceForm(formData);
    const decoded = Schema.decodeUnknownResult(
      termsOfServiceEditorDefinition.schema,
    )(candidate);

    if (
      Result.isFailure(decoded) ||
      !candidate.title.trim() ||
      !candidate.bodyMarkdown.trim()
    ) {
      return fail(400, {
        action: "save",
        message: "Please provide a title and body before saving.",
        values: candidate,
      });
    }

    await saveTermsOfServiceEditorValue(decoded.success);

    throw redirect(303, `${termsOfServiceEditorPath()}?saved=1`);
  },
};
