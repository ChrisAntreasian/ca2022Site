import { error, fail, redirect } from "@sveltejs/kit";
import { Result, Schema } from "effect";

import {
  isEditorUnlockedForRequest,
  requireEditorAccess,
} from "#lib/editing/core/session.server";
import {
  poemEditorDefinition,
  toPoemEditorValues,
} from "#lib/editing/resources/poems/poems";
import {
  deletePoemEditorValue,
  ensurePoemsBaselineSnapshot,
  readPoemsFile,
  releasePoemsFile,
  savePoemEditorValue,
} from "#lib/editing/resources/poems/poems.server";
import {
  parsePoemEditorParam,
  parsePoemForm,
  poemEditorPath,
  selectPoem,
} from "#lib/editing/resources/poems/poems-editor";
import { getFormDataString } from "#lib/form-data";
import { isReleasable } from "#lib/content.server";

import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ cookies, params, url }) => {
  requireEditorAccess(cookies);

  const poemsFile = await readPoemsFile();
  await ensurePoemsBaselineSnapshot(poemsFile);
  const poems = toPoemEditorValues(poemsFile);
  const fallbackPoemId = poems[0]?.id ?? 0;
  const parsedPoemId = params.pid ? parsePoemEditorParam(params.pid) : null;
  const poemId = parsedPoemId ?? fallbackPoemId;

  if (parsedPoemId === null && params.pid) {
    throw error(404, "Poem editor route not found.");
  }

  const selectedPoem = selectPoem(
    poems,
    poemId,
    poemEditorDefinition.createDefault,
  );

  if (!selectedPoem) {
    throw error(404, "Poem not found.");
  }

  const status =
    url.searchParams.get("deleted") === "1"
      ? ({ title: "Poem deleted", message: "Poem deleted." } as const)
      : url.searchParams.get("saved") === "1"
        ? ({ title: "Poem saved", message: "Poem saved." } as const)
        : url.searchParams.get("released")
          ? ({
              title: "Poems released",
              message: `The working draft was published to live (version ${url.searchParams.get("released")}).`,
            } as const)
          : null;

  return {
    editorEnabled: isEditorUnlockedForRequest(cookies),
    savedTitle: status?.title ?? null,
    savedMessage: status?.message ?? null,
    // Drives whether the release control appears at all, so the UI cannot offer an action the guard on
    // the server side would reject.
    releaseAvailable: isReleasable("poems"),
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
  save: async ({ cookies, request }) => {
    requireEditorAccess(cookies);

    const formData = await request.formData();
    const candidate = parsePoemForm(formData);
    const redirectTo = getFormDataString(formData, "redirectTo").trim();
    const decoded = Schema.decodeUnknownResult(poemEditorDefinition.schema)(
      candidate,
    );

    if (Result.isFailure(decoded)) {
      return fail(400, {
        action: "save",
        message: "Please provide a title, body, and numeric sort order.",
        values: candidate,
      });
    }

    const poem = decoded.success;
    const file = await savePoemEditorValue(poem);
    const savedItems = file.data.data ?? [];
    const savedId =
      poem.id > 0 ? poem.id : Math.max(...savedItems.map((item) => item.id));
    const savedItem = savedItems.find((item) => item.id === savedId);
    const destination =
      redirectTo ||
      poemEditorPath(savedId, savedItem?.attributes.title ?? poem.title);

    throw redirect(303, `${destination}?saved=1`);
  },
  delete: async ({ cookies, request }) => {
    requireEditorAccess(cookies);

    const formData = await request.formData();
    const poemId = Number(getFormDataString(formData, "id") || "0");

    if (!Number.isInteger(poemId) || poemId <= 0) {
      return fail(400, {
        action: "delete",
        message: "Please select a saved poem before deleting.",
      });
    }

    const source = await readPoemsFile();
    const poems = toPoemEditorValues(source);

    if (!poems.some((poem) => poem.id === poemId)) {
      throw error(404, "Poem not found.");
    }

    const updated = await deletePoemEditorValue(poemId, new Date(), source);
    const remaining = toPoemEditorValues(updated);
    const nextPoem = remaining[0];
    const destination = nextPoem
      ? poemEditorPath(nextPoem.id, nextPoem.title)
      : poemEditorPath("new");

    throw redirect(303, `${destination}?deleted=1`);
  },
  /**
   * Publish the working draft to live. Availability is checked before attempting anything, so while live
   * content is still on disk this reports that releases are not open yet instead of failing obscurely —
   * the route is reachable any time `ENABLE_CONTENT_EDITOR` is on, and a release once live content lives
   * in S3 mutates durable storage.
   */
  release: async ({ cookies }) => {
    requireEditorAccess(cookies);

    if (!isReleasable("poems")) {
      return fail(400, {
        action: "release",
        message:
          "Releases are not available yet: live content is still bundled. Set CONTENT_LIVE_SOURCE=s3 once the data has been seeded.",
      });
    }

    const timestamp = await releasePoemsFile();

    throw redirect(303, `/poems?released=${timestamp}`);
  },
};
