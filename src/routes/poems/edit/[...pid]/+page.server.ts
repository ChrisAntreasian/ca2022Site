import { error, fail, redirect } from "@sveltejs/kit";
import { Either, Schema } from "effect";

import {
  isEditorEnabled,
  requireEditorEnabled,
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
} from "$lib/editing/poems-editor";
import { getFormDataString } from "$lib/form-data";

import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, url }) => {
  requireEditorEnabled();

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
    editorEnabled: isEditorEnabled(),
    savedMessage: url.searchParams.get("saved") === "1" ? "Poem saved." : null,
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
  save: async ({ request }) => {
    requireEditorEnabled();

    const formData = await request.formData();
    const candidate = parsePoemForm(formData);
    const redirectTo = getFormDataString(formData, "redirectTo").trim();
    const decoded = Schema.decodeUnknownEither(poemEditorDefinition.schema)(candidate);

    if (Either.isLeft(decoded)) {
      return fail(400, {
        action: "save",
        message: "Please provide a title, body, and numeric sort order.",
        values: candidate,
      });
    }

    const file = await savePoemEditorValue(decoded.right);
    const savedItems = file.data.data ?? [];
    const savedId =
      decoded.right.id > 0
        ? decoded.right.id
        : Math.max(...savedItems.map((item) => item.id));
    const savedItem = savedItems.find((item) => item.id === savedId);
    const destination = redirectTo || poemEditorPath(savedId, savedItem?.attributes.title ?? decoded.right.title);

    throw redirect(
      303,
      `${destination}?saved=1`,
    );
  },
};