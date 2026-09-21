import { error, fail, redirect } from "@sveltejs/kit";

import {
  isEditorEnabled,
  requireEditorEnabled,
} from "$lib/editing/auth.server";
import {
  applyWebExperienceMediaPatch,
  buildWebExperienceTarget,
  toWebExperienceEditorValue,
  webExperienceEditorDefinition,
  type WebExperienceEntry,
} from "$lib/editing/web-experience";
import {
  deleteWebExperienceEntry,
  deleteWebExperienceMedia,
  ensureWebExperienceBaselineSnapshot,
  persistWebExperienceUpload,
  readWebExperienceFile,
  saveWebExperienceEditorValue,
  writeWebExperienceFile,
} from "$lib/editing/web-experience.server";
import {
  mergeWebExperienceValue,
  parseWebExperienceEditorParam,
  parseWebExperienceForm,
  selectWebExperienceTarget,
  webExperienceEditorPath,
} from "$lib/editing/web-experience-editor";
import { getFormDataString } from "$lib/form-data";

import type { Actions, PageServerLoad } from "./$types";

const resolveSavedEntry = (
  entries: ReadonlyArray<WebExperienceEntry>,
  requestedEntryId: number,
) =>
  requestedEntryId > 0
    ? entries.find((entry) => entry.id === requestedEntryId) ?? null
    : [...entries].sort((left, right) => right.id - left.id)[0] ?? null;

export const load: PageServerLoad = async ({ params, url }) => {
  requireEditorEnabled();

  const requestedSelection = params.wid
    ? parseWebExperienceEditorParam(params.wid)
    : null;

  if (!requestedSelection && params.wid) {
    throw error(404, "Web experience editor route not found.");
  }

  const source = await readWebExperienceFile();
  await ensureWebExperienceBaselineSnapshot(source);
  const editorValue = toWebExperienceEditorValue(source);
  const selection = requestedSelection ??
    (editorValue.entries[0]
      ? ({ kind: "entry", id: editorValue.entries[0].id } as const)
      : ({ kind: "intro" } as const));
  const target = buildWebExperienceTarget(
    source,
    editorValue,
    selection,
  );

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
      newPath: webExperienceEditorPath({ kind: "new" }),
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
    const formData = await request.formData();
    const parsedForm = parseWebExperienceForm(formData);
    const current = toWebExperienceEditorValue(source);
    const redirectTo = getFormDataString(formData, "redirectTo").trim();
    const merged = mergeWebExperienceValue(current, parsedForm);

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
        values:
          formData.get("kind") === "intro"
            ? {
                kind: "intro",
                pageTitle: merged.pageTitle,
                title: merged.introTitle,
                bodyMarkdown: merged.introBodyMarkdown,
              }
            : selectWebExperienceTarget(merged, {
                kind: "entry",
                id: Number(getFormDataString(formData, "id") || "0"),
              }),
      });
    }

    const removeLogo = parsedForm.kind === "entry" && formData.has("removeLogo");
    const removeImageIds = parsedForm.kind === "entry"
      ? formData
          .getAll("removeImageIds")
          .map((value) => Number(String(value)))
          .filter((value) => Number.isInteger(value) && value > 0)
      : [];

    const logoRaw = formData.get("logoFile");
    const logoFile =
      parsedForm.kind === "entry" && logoRaw instanceof File && logoRaw.size > 0
        ? logoRaw
        : null;
    const screenshotFiles =
      parsedForm.kind === "entry"
        ? formData
            .getAll("imageFiles")
            .filter((candidate): candidate is File =>
              candidate instanceof File && candidate.size > 0,
            )
        : [];

    const uploadedLogo = logoFile
      ? await persistWebExperienceUpload(logoFile)
      : undefined;
    const uploadedScreenshots =
      screenshotFiles.length > 0
        ? await Promise.all(
            screenshotFiles.map((file) => persistWebExperienceUpload(file)),
          )
        : undefined;

    let saved = await saveWebExperienceEditorValue(merged, new Date(), source);
    let savedValue = toWebExperienceEditorValue(saved);
    const requestedEntryId = parsedForm.kind === "entry" ? parsedForm.id : 0;
    const selectedEntry =
      parsedForm.kind === "entry"
        ? resolveSavedEntry(savedValue.entries, requestedEntryId)
        : null;

    if (parsedForm.kind === "entry" && selectedEntry) {
      const shouldUpdateMedia =
        removeLogo ||
        removeImageIds.length > 0 ||
        uploadedLogo !== undefined ||
        uploadedScreenshots !== undefined;

      if (shouldUpdateMedia) {
        const originalEntry = source.data.data?.[0]?.attributes.rich_links?.data?.find(
          (entry) => entry.id === selectedEntry.id,
        );

        saved = applyWebExperienceMediaPatch(saved, {
          entryId: selectedEntry.id,
          removeLogo,
          logo: uploadedLogo,
          removeImageIds,
          images: uploadedScreenshots,
        });

        await writeWebExperienceFile(saved);

        const deleteTargets = [
          ...(removeLogo || uploadedLogo !== undefined
            ? [originalEntry?.attributes.logo.data?.attributes.url]
            : []),
          ...(removeImageIds.length > 0
            ? (originalEntry?.attributes.image.data ?? [])
                .filter((image) => removeImageIds.includes(image.id))
                .map((image) => image?.attributes.url)
            : []),
        ].filter((url): url is string => Boolean(url));

        await Promise.all(deleteTargets.map((url) => deleteWebExperienceMedia(url)));

        savedValue = toWebExperienceEditorValue(saved);
      }
    }

    const targetPath = redirectTo
      ? redirectTo
      : parsedForm.kind === "intro"
        ? webExperienceEditorPath({ kind: "intro" })
        : (() => {
            const selected = selectedEntry;

            if (!selected) {
              throw error(404, "Saved web experience entry not found.");
            }

            return webExperienceEditorPath({ kind: "entry", id: selected.id }, selected.title);
          })();

    throw redirect(303, `${targetPath}?saved=1`);
  },
  delete: async ({ request }) => {
    requireEditorEnabled();

    const source = await readWebExperienceFile();
    const current = toWebExperienceEditorValue(source);
    const formData = await request.formData();
    const parsedForm = parseWebExperienceForm(formData);

    if (parsedForm.kind !== "entry") {
      return fail(400, {
        action: "delete",
        message: "Only saved entries can be deleted.",
      });
    }

    if (parsedForm.id <= 0 || !Number.isInteger(parsedForm.id)) {
      return fail(400, {
        action: "delete",
        message: "Please select a saved entry before deleting.",
      });
    }

    if (!current.entries.some((entry) => entry.id === parsedForm.id)) {
      throw error(404, "Web experience entry not found.");
    }

    const updated = await deleteWebExperienceEntry(parsedForm.id, new Date(), source);
    const remaining = toWebExperienceEditorValue(updated).entries[0];
    const destination = remaining
      ? webExperienceEditorPath({ kind: "entry", id: remaining.id }, remaining.title)
      : webExperienceEditorPath({ kind: "intro" });

    throw redirect(303, `${destination}?saved=1`);
  },
};