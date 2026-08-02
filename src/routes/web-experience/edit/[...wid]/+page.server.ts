import { error, fail, redirect } from "@sveltejs/kit";

import {
  isEditorEnabled,
  requireEditorEnabled,
} from "$lib/editing/auth.server";
import {
  toWebExperienceEditorValue,
  webExperienceEditorDefinition,
} from "$lib/editing/web-experience";
import {
  ensureWebExperienceBaselineSnapshot,
  readWebExperienceFile,
  saveWebExperienceEditorValue,
} from "$lib/editing/web-experience.server";

import {
  mergeWebExperienceValue,
  parseWebExperienceEditorParam,
  parseWebExperienceForm,
  selectWebExperienceTarget,
  webExperienceEditorPath,
} from "../editor";

import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, url }) => {
  requireEditorEnabled();

  const selection = parseWebExperienceEditorParam(params.wid);

  if (!selection) {
    throw error(404, "Web experience editor route not found.");
  }

  const source = await readWebExperienceFile();
  await ensureWebExperienceBaselineSnapshot(source);
  const editorValue = toWebExperienceEditorValue(source);
  const target = selectWebExperienceTarget(editorValue, selection);

  if (!target) {
    throw error(404, "Web experience target not found.");
  }

  return {
    editorEnabled: isEditorEnabled(),
    savedMessage:
      url.searchParams.get("saved") === "1" ? "Web experience entry saved." : null,
    editor: {
      key: webExperienceEditorDefinition.key,
      label: webExperienceEditorDefinition.label,
      introPath: webExperienceEditorPath({ kind: "intro" }),
    },
    pageTitle: editorValue.pageTitle,
    entries: editorValue.entries,
    target,
  };
};

export const actions: Actions = {
  save: async ({ request }) => {
    requireEditorEnabled();

    const source = await readWebExperienceFile();
    const current = toWebExperienceEditorValue(source);
    const formData = await request.formData();
    const redirectTo = String(formData.get("redirectTo") ?? "").trim();
    const merged = mergeWebExperienceValue(current, parseWebExperienceForm(formData));
    const saved = await saveWebExperienceEditorValue(merged);
    const savedValue = toWebExperienceEditorValue(saved);

    const targetPath = redirectTo
      ? redirectTo
      : formData.get("kind") === "intro"
        ? webExperienceEditorPath({ kind: "intro" })
        : (() => {
            const selected = savedValue.entries.find(
              (entry) => entry.id === Number(formData.get("id") ?? "0"),
            );

            if (!selected) {
              throw error(404, "Saved web experience entry not found.");
            }

            return webExperienceEditorPath({ kind: "entry", id: selected.id }, selected.title);
          })();

    if (
      !merged.pageTitle.trim() ||
      !merged.introTitle.trim() ||
      !merged.introBodyMarkdown.trim() ||
      merged.entries.some(
        (entry) =>
          !entry.title.trim() ||
          !entry.bodyMarkdown.trim() ||
          !entry.primaryLink.trim() ||
          Number.isNaN(entry.sortOrder),
      )
    ) {
      return fail(400, {
        action: "save",
        message: "Please complete the required fields before saving.",
        values: formData.get("kind") === "intro"
          ? {
              kind: "intro",
              pageTitle: merged.pageTitle,
              title: merged.introTitle,
              bodyMarkdown: merged.introBodyMarkdown,
            }
          : selectWebExperienceTarget(merged, {
              kind: "entry",
              id: Number(formData.get("id") ?? "0"),
            }),
      });
    }

    throw redirect(303, `${targetPath}?saved=1`);
  },
};