import { fail, redirect } from "@sveltejs/kit";

import { isEditorEnabled } from "#lib/editing/core/auth.server";
import {
  createEditorSession,
  editorSessionCookieName,
  editorSessionCookieOptions,
  isEditorUsable,
  verifyEditorEditKey,
} from "#lib/editing/core/session.server";
import { getFormDataString } from "#lib/form-data";

import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ cookies }) => {
  // Already unlocked visitors skip the form. The redirect target is an editor page, so it only works while
  // the editor is enabled; a disabled editor just renders the (inert) form.
  if (isEditorUsable() && cookies.get(editorSessionCookieName)) {
    throw redirect(303, "/poems");
  }

  return {};
};

export const actions: Actions = {
  unlock: async ({ cookies, request }) => {
    if (!isEditorEnabled()) {
      return fail(403, { message: "The editor is not available." });
    }

    const data = await request.formData();

    // One generic message for a wrong key and a missing one, so the page cannot be used to probe whether a
    // key is configured at all.
    if (!verifyEditorEditKey(getFormDataString(data, "editKey"))) {
      return fail(401, { message: "That edit key was not accepted." });
    }

    cookies.set(
      editorSessionCookieName,
      createEditorSession(),
      editorSessionCookieOptions,
    );

    const redirectTo = data.get("redirectTo");
    const target = isSafeRedirectTarget(redirectTo) ? redirectTo : "/poems";

    throw redirect(303, target);
  },
};

/**
 * A redirect target the visitor supplied, so it must be checked rather than trusted. `//host` and `/\host`
 * both start with a slash yet resolve to another origin - an open redirect here would send the freshly minted
 * session cookie to an attacker's domain. Only the leading pair matters: a doubled slash further along is just
 * an empty path segment, but it is rejected too because browsers collapse it and it signals a malformed target.
 */
const isSafeRedirectTarget = (value: unknown): value is string => {
  if (typeof value !== "string" || !value.startsWith("/")) {
    return false;
  }
  if (value.startsWith("//") || value.startsWith("/\\")) {
    return false;
  }
  if (value.includes("//")) {
    return false;
  }
  // Control characters and whitespace would break the Location header or split a response.
  if (/[^!-~]/.test(value)) {
    return false;
  }
  return true;
};
