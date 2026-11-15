import { error, fail, redirect } from "@sveltejs/kit";
import { Result, Schema } from "effect";

import {
  isEditorUnlockedForRequest,
  requireEditorAccess,
} from "#lib/editing/core/session.server";
import {
  landingEditorDefinition,
  landingSectionC,
} from "#lib/editing/resources/landing/landing";
import {
  landingEditorPath,
  parseLandingEditorParam,
  parseLandingSectionForm,
  selectLandingSection,
} from "#lib/editing/resources/landing/landing-editor";
import {
  ensureLandingBaselineSnapshot,
  readLandingFile,
  saveLandingSectionEditorValue,
} from "#lib/editing/resources/landing/landing.server";
import { toLandingEditorValue } from "#lib/editing/resources/landing/landing";

import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ cookies, params, url }) => {
  requireEditorAccess(cookies);

  const file = await readLandingFile();
  await ensureLandingBaselineSnapshot(file);
  const landing = toLandingEditorValue(file);
  const fallbackSectionId = landing.sections[0]?.id ?? 0;
  const parsedSectionId = params.sid
    ? parseLandingEditorParam(params.sid)
    : null;
  const sectionId = parsedSectionId ?? fallbackSectionId;

  if (parsedSectionId === null && params.sid) {
    throw error(404, "Home page editor route not found.");
  }

  const selectedSection = selectLandingSection(landing, sectionId);

  if (!selectedSection) {
    throw error(404, "Home page section not found.");
  }

  const status =
    url.searchParams.get("saved") === "1"
      ? ({
          title: "Section saved",
          message: "Home page section saved.",
        } as const)
      : null;

  return {
    editorEnabled: isEditorUnlockedForRequest(cookies),
    savedTitle: status?.title ?? null,
    savedMessage: status?.message ?? null,
    editor: {
      key: landingEditorDefinition.key,
      label: landingEditorDefinition.label,
      fields: landingEditorDefinition.fields,
    },
    landing,
    selectedSection,
  };
};

export const actions: Actions = {
  save: async ({ cookies, request }) => {
    requireEditorAccess(cookies);

    const formData = await request.formData();
    const candidate = parseLandingSectionForm(formData);
    const decoded = Schema.decodeUnknownResult(landingSectionC)(candidate);

    if (Result.isFailure(decoded) || !candidate.title.trim()) {
      return fail(400, {
        action: "save",
        message: "Please provide a section title before saving.",
        values: candidate,
      });
    }

    const section = decoded.success;
    await saveLandingSectionEditorValue(section);

    throw redirect(303, `${landingEditorPath(section.id)}?saved=1`);
  },
};
