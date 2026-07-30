import { dev } from "$app/environment";
import { env } from "$env/dynamic/private";
import type { Cookies } from "@sveltejs/kit";

import { e403 } from "$lib/error";

const editCookieName = "ca2022-content-edit";

const cookieOptions = {
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  secure: !dev,
  maxAge: 60 * 60 * 8,
};

const configuredEditKey = () => env.CONTENT_EDIT_KEY?.trim() ?? "";

export const hasEditKeyConfigured = () => configuredEditKey().length > 0;

export const isEditorAuthorized = (cookies: Cookies) => {
  const key = configuredEditKey();

  return key.length > 0 && cookies.get(editCookieName) === key;
};

export const authorizeEditor = (cookies: Cookies, submittedKey: string) => {
  const key = configuredEditKey();

  if (!key || submittedKey !== key) {
    return false;
  }

  cookies.set(editCookieName, key, cookieOptions);
  return true;
};

export const clearEditorAuthorization = (cookies: Cookies) => {
  cookies.delete(editCookieName, { path: "/" });
};

export const requireEditor = (cookies: Cookies) => {
  if (!isEditorAuthorized(cookies)) {
    throw e403("Permission denied.");
  }
};