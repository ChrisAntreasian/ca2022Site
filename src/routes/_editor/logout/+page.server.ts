import { redirect } from "@sveltejs/kit";

import {
  editorSessionCookieName,
  editorSessionDeleteOptions,
} from "#lib/editing/core/session.server";

import type { Actions } from "./$types";

export const actions: Actions = {
  default: async ({ cookies }) => {
    // Clearing the cookie is safe even when there was no session, and this route is reachable only while the
    // editor is enabled - it never reports whether one exists.
    cookies.set(editorSessionCookieName, "", editorSessionDeleteOptions);

    throw redirect(303, "/");
  },
};
