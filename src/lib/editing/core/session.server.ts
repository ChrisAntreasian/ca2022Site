import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { EDITOR_EDIT_KEY, EDITOR_SESSION_SECRET } from "$app/env/private";

import { e403, e500 } from "#lib/error";
import { isEditorEnabled } from "./auth.server";

/**
 * Editor authentication.
 *
 * `ENABLE_CONTENT_EDITOR` decides whether the editor exists at all; it is not a credential. This module adds
 * the credential: an unlock form posts EDITOR_EDIT_KEY, which mints a signed, httpOnly session cookie that
 * every editor route then requires. A stolen edit key cannot be replayed as a cookie - only minting a fresh
 * one can, and only through the unlock route.
 */

const SESSION_COOKIE = "editor_session";
/** An unlocked editor is a working window, not a permanent state. */
const SESSION_TTL_SECONDS = 12 * 60 * 60;

/**
 * Read at runtime from `$app/env/private`, which re-reads the environment on each access, so a secret can be
 * rotated without rebuilding and never reaches the client bundle - only server modules can import this.
 */
export const isEditorConfigured = () =>
  (EDITOR_EDIT_KEY ?? "").trim().length > 0;

/**
 * The editor is usable when a key is configured and the feature flag is on. A missing key is treated as a
 * closed editor rather than an open one, so a misconfigured deploy cannot expose edit routes at all.
 */
export const isEditorUsable = () => isEditorEnabled() && isEditorConfigured();

/**
 * Ephemeral fallback is per-process, not per-call. Generating it lazily inside `signingSecret()` would mean
 * each call produced a different key, so a session minted by the unlock form would fail to verify on the next
 * request - the editor would look like it locked itself immediately after unlocking. Memoising keeps one
 * process consistent while still ensuring a restart cannot verify old sessions, which is the point of the flag.
 */
let ephemeralSecret: string | null = null;

const signingSecret = () => {
  const configured = (EDITOR_SESSION_SECRET ?? "").trim();
  if (configured) {
    return configured;
  }
  if (!ephemeralSecret) {
    console.error(
      "EDITOR_SESSION_SECRET is not set; editor sessions will be signed with an ephemeral key and invalidated by each cold start.",
    );
    ephemeralSecret = `ephemeral-editor-secret:${randomBytes(32).toString("hex")}`;
  }
  return ephemeralSecret;
};

const signature = (payload: string) =>
  createHmac("sha256", signingSecret()).update(payload).digest("hex");

/** Sessions are signed, not encrypted - they carry an expiry and nothing else, so no content is exposed. */
type SessionPayload = { unlockedAt: number; expiresAt: number };

const encodeSession = (payload: SessionPayload) => {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${signature(body)}`;
};

const decodeSession = (value: string): SessionPayload | null => {
  const [body, signaturePart] = value.split(".");
  if (!body || !signaturePart) {
    return null;
  }

  // Constant-time against a length-mismatched forgery.
  const expected = Buffer.from(signature(body));
  const provided = Buffer.from(signaturePart);
  if (
    expected.length !== provided.length ||
    !timingSafeEqual(expected, provided)
  ) {
    return null;
  }

  let payload: SessionPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (
    typeof payload?.unlockedAt !== "number" ||
    typeof payload.expiresAt !== "number" ||
    payload.expiresAt <= Date.now()
  ) {
    return null;
  }

  return payload;
};

export const createEditorSession = () =>
  encodeSession({
    unlockedAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000,
  });

/** Session cookie options. `sameSite: "lax"` is deliberate: the unlock form posts same-site, and lax keeps
 * it working on a top-level navigation while refusing cross-site POSTs. */
export const editorSessionCookieOptions = {
  httpOnly: true,
  secure: !import.meta.env.DEV,
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};

export const editorSessionDeleteOptions = {
  httpOnly: true,
  secure: !import.meta.env.DEV,
  sameSite: "lax" as const,
  path: "/",
  maxAge: undefined,
};

const readSession = (cookies: {
  get: (name: string) => string | undefined;
}) => {
  const raw = cookies.get(SESSION_COOKIE);
  return raw ? decodeSession(raw) : null;
};

/** True only for a signed, unexpired session. Does not throw - callers use it to decide what to render. */
export const isEditorUnlocked = (cookies: {
  get: (name: string) => string | undefined;
}) => readSession(cookies) !== null;

/**
 * Whether public pages should offer an "Edit post" link. A locked editor must not advertise routes it will
 * refuse, so this is deliberately flag AND session rather than the flag alone - which is also why every page
 * that renders such a link needs no change beyond the value it receives.
 */
export const isEditorUnlockedForRequest = (cookies: {
  get: (name: string) => string | undefined;
}) => isEditorUsable() && isEditorUnlocked(cookies);

/**
 * The gate for every editor load and action. Order matters: a disabled feature flag should report "not
 * found" rather than "forbidden", so production never advertises that an editor exists behind a key.
 */
export const requireEditorAccess = (cookies: {
  get: (name: string) => string | undefined;
}) => {
  if (!isEditorEnabled()) {
    throw e403("Permission denied.");
  }
  if (!isEditorConfigured()) {
    throw e500(
      "Editor is enabled but EDITOR_EDIT_KEY is not configured, so it cannot be unlocked.",
    );
  }
  if (!isEditorUnlocked(cookies)) {
    throw e403("The editor needs the edit key before it can be used.");
  }
};

/**
 * Compare against the configured key. Returns false rather than throwing when no key is set, so a failed
 * comparison cannot reveal that the deploy is misconfigured.
 */
export const verifyEditorEditKey = (candidate: string | null | undefined) => {
  const configured = (EDITOR_EDIT_KEY ?? "").trim();
  if (!configured) {
    return false;
  }

  const provided = Buffer.from(candidate ?? "");
  const expected = Buffer.from(configured);
  // Length is not secret-bearing here, but comparing unequal lengths with timingSafeEqual throws.
  if (provided.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(provided, expected);
};

export const editorSessionCookieName = SESSION_COOKIE;
