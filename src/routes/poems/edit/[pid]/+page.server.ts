import { error, fail, redirect } from "@sveltejs/kit";
import { Either, Schema } from "effect";

import {
  authorizeEditor,
  clearEditorAuthorization,
  hasEditKeyConfigured,
  isEditorAuthorized,
  requireEditor,
} from "$lib/editing/auth.server";
import {
  poemEditorDefinition,
  toPoemEditorValues,
} from "$lib/editing/poems";
import {
  ensurePoemsBaselineSnapshot,
  readPoemsFile,
  savePoemEditorValue,
} from "$lib/editing/poems.server";

import {
  parsePoemEditorParam,
  parsePoemForm,
  poemEditorPath,
  selectPoem,
} from "../editor";

import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ cookies, params }) => {
  const poemId = parsePoemEditorParam(params.pid);

  if (poemId === null) {
    throw error(404, "Poem editor route not found.");
  }

  const poemsFile = await readPoemsFile();
  await ensurePoemsBaselineSnapshot(poemsFile);
  const poems = toPoemEditorValues(poemsFile);
  const selectedPoem = selectPoem(poems, poemId, poemEditorDefinition.createDefault);

  if (!selectedPoem) {
    throw error(404, "Poem not found.");
  }

  return {
    authorized: isEditorAuthorized(cookies),
    hasEditKeyConfigured: hasEditKeyConfigured(),
    editor: {
      key: poemEditorDefinition.key,
      label: poemEditorDefinition.label,
      fields: poemEditorDefinition.fields,
      newPath: poemEditorPath("new"),
    },
    poems,
    selectedPoem,
  };
};

export const actions: Actions = {
  authorize: async ({ cookies, request }) => {
    const formData = await request.formData();
    const editKey = String(formData.get("editKey") ?? "").trim();

    if (!hasEditKeyConfigured()) {
      return fail(500, {
        action: "authorize",
        message: "CONTENT_EDIT_KEY is not configured.",
      });
    }

    if (!authorizeEditor(cookies, editKey)) {
      return fail(403, {
        action: "authorize",
        message: "Invalid edit key.",
      });
    }

    return {
      action: "authorize",
      message: "Edit mode enabled.",
    };
  },

  logout: async ({ cookies }) => {
    clearEditorAuthorization(cookies);

    return {
      action: "logout",
      message: "Edit mode disabled.",
    };
  },

  save: async ({ cookies, request }) => {
    requireEditor(cookies);

    const candidate = parsePoemForm(await request.formData());
    const decoded = Schema.decodeUnknownEither(poemEditorDefinition.schema)(candidate);

    if (Either.isLeft(decoded)) {
      return fail(400, {
        action: "save",
        message: "Please provide a title, body, and numeric sort order.",
        values: candidate,
      });
    }

    const file = await savePoemEditorValue(decoded.right);
    const savedId =
      decoded.right.id > 0
        ? decoded.right.id
        : Math.max(...(file.data.data ?? []).map((item) => item.id));

    throw redirect(303, poemEditorPath(savedId));
  },
};