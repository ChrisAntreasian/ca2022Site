import { fail, redirect } from "@sveltejs/kit";
import { Result, Schema } from "effect";

import {
  isEditorUnlockedForRequest,
  requireEditorAccess,
} from "#lib/editing/core/session.server";
import { layoutEditorDefinition } from "#lib/editing/resources/layout/layout";
import {
  layoutEditorPath,
  parseLayoutForm,
} from "#lib/editing/resources/layout/layout-editor";
import {
  ensureLayoutBaselineSnapshot,
  readLayoutFile,
  saveLayoutEditorValue,
} from "#lib/editing/resources/layout/layout.server";
import { toLayoutEditorValue } from "#lib/editing/resources/layout/layout";

import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ cookies, url }) => {
  requireEditorAccess(cookies);

  const file = await readLayoutFile();
  await ensureLayoutBaselineSnapshot(file);
  const layout = toLayoutEditorValue(file);

  const status =
    url.searchParams.get("saved") === "1"
      ? ({ title: "Layout saved", message: "Site layout saved." } as const)
      : null;

  return {
    editorEnabled: isEditorUnlockedForRequest(cookies),
    savedTitle: status?.title ?? null,
    savedMessage: status?.message ?? null,
    editor: {
      key: layoutEditorDefinition.key,
      label: layoutEditorDefinition.label,
      path: layoutEditorPath(),
    },
    layout,
  };
};

export const actions: Actions = {
  save: async ({ cookies, request }) => {
    requireEditorAccess(cookies);

    const formData = await request.formData();
    const candidate = parseLayoutForm(formData);
    const decoded = Schema.decodeUnknownResult(layoutEditorDefinition.schema)(
      candidate,
    );

    if (Result.isFailure(decoded) || !candidate.title.trim()) {
      return fail(400, {
        action: "save",
        message: "Please provide a header title before saving.",
        values: candidate,
      });
    }

    await saveLayoutEditorValue(decoded.success);

    throw redirect(303, `${layoutEditorPath()}?saved=1`);
  },
};
