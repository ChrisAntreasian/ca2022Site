import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeCookies } from "./fakeCookies";

/**
 * The unlock route end to end: a wrong key must not create a session, and a correct key must create one that
 * the editor gate actually accepts. Page tests mock auth wholesale, so this is where the real cookie minting
 * gets checked.
 */

const KEY = "the-owner-key";

const env: Record<string, string | undefined> = {};

vi.doMock("$app/env/private", () => ({
  get ENABLE_CONTENT_EDITOR() {
    return env.ENABLE_CONTENT_EDITOR;
  },
  get EDITOR_EDIT_KEY() {
    return env.EDITOR_EDIT_KEY;
  },
  get EDITOR_SESSION_SECRET() {
    return env.EDITOR_SESSION_SECRET;
  },
}));

const configureEditor = (
  overrides: Record<string, string | undefined> = {},
) => {
  env.ENABLE_CONTENT_EDITOR = "true";
  env.EDITOR_EDIT_KEY = KEY;
  env.EDITOR_SESSION_SECRET = "unlock-test-secret";
  Object.assign(env, overrides);
};

const routeWith = async () => {
  vi.resetModules();
  const mod = await import("../../src/routes/_editor/unlock/+page.server");
  const sessionMod = await import("../../src/lib/editing/core/session.server");
  return { unlock: mod.actions.unlock, sessionMod };
};

const requestWithEditKey = (editKey: string | null) => ({
  request: {
    formData: async () => {
      const form = new FormData();
      if (editKey !== null) {
        form.set("editKey", editKey);
      }
      return form;
    },
  },
});

const runUnlock = async (editKey: string | null, cookies = fakeCookies()) => {
  const { unlock, sessionMod } = await routeWith();
  let outcome: unknown;

  try {
    outcome = await unlock({
      cookies,
      request: requestWithEditKey(editKey).request,
    } as never);
  } catch (thrown) {
    outcome = thrown;
  }

  return { outcome, cookies, sessionMod };
};

/**
 * `redirect()` throws a Kit `Redirect`, which carries status and location directly. Reading it through this
 * helper keeps the assertion honest: if the shape ever changes, these tests fail loudly instead of comparing
 * against an undefined property.
 */
const asRedirect = (thrown: unknown) => {
  const redirectError = thrown as { status?: number; location?: string };

  if (
    typeof redirectError?.status !== "number" ||
    typeof redirectError?.location !== "string"
  ) {
    throw new Error(`expected a Kit redirect, got ${JSON.stringify(thrown)}`);
  }

  return { status: redirectError.status, location: redirectError.location };
};

const runUnlockWithRedirect = async (redirectTo: string | null) => {
  const { unlock } = await routeWith();
  const cookies = fakeCookies();
  const form = new FormData();
  form.set("editKey", KEY);

  if (redirectTo !== null) {
    form.set("redirectTo", redirectTo);
  }

  try {
    await unlock({
      cookies,
      request: { formData: async () => form },
    } as never);
  } catch (thrown) {
    return { outcome: asRedirect(thrown), cookies };
  }

  // A valid edit key must always end in a redirect; reaching this line means the action returned instead.
  throw new Error("unlock() was expected to throw a redirect");
};

describe("editor unlock route", () => {
  beforeEach(() => {
    configureEditor();
    vi.resetModules();
  });

  it("mints a session the editor gate accepts when the key is correct", async () => {
    const { outcome, cookies, sessionMod } = await runUnlock(KEY);
    const cookieValue = cookies.get(sessionMod.editorSessionCookieName);

    expect((outcome as { status?: number }).status).toBe(303);
    expect(cookieValue).toBeTruthy();
    expect(
      sessionMod.isEditorUnlocked({ get: (n: string) => cookies.get(n) }),
    ).toBe(true);
  });

  it("creates no session for a wrong key", async () => {
    const { outcome, cookies, sessionMod } = await runUnlock("wrong-key");
    const cookieValue = cookies.get(sessionMod.editorSessionCookieName);

    expect((outcome as { status?: number }).status).toBe(401);
    expect(cookieValue).toBeUndefined();
  });

  it("creates no session when the key is missing from the form", async () => {
    const { outcome, cookies } = await runUnlock(null);

    expect((outcome as { status?: number }).status).toBe(401);
    expect(cookies.get("editor_session")).toBeUndefined();
  });

  it("reports a single generic message instead of revealing configuration", async () => {
    configureEditor({ EDITOR_EDIT_KEY: undefined });
    const { outcome } = await runUnlock(KEY);
    const failure = outcome as { status?: number; data?: { message?: string } };

    expect(failure.status).toBe(401);
    // The same wording for a missing key, a wrong key and an unconfigured deploy, so the unlock form cannot
    // be used to find out whether a deployment has a key at all.
    expect(failure.data?.message).toBe("That edit key was not accepted.");

    const wrongKey = await runUnlock("wrong-key");
    expect(
      (wrongKey.outcome as { data?: { message?: string } }).data?.message,
    ).toBe(failure.data?.message);
  });

  it("refuses to unlock when the editor is disabled", async () => {
    configureEditor({ ENABLE_CONTENT_EDITOR: "false" });
    const { outcome, cookies } = await runUnlock(KEY);

    expect((outcome as { status?: number }).status).toBe(403);
    expect(cookies.get("editor_session")).toBeUndefined();
  });

  it("redirects to the page the visitor came from", async () => {
    const { outcome } = await runUnlockWithRedirect("/poems/edit/4/new-poem");

    expect(outcome.status).toBe(303);
    expect(outcome.location).toBe("/poems/edit/4/new-poem");
  });

  it("falls back to /poems when no redirect target is supplied", async () => {
    const { outcome } = await runUnlockWithRedirect(null);

    expect(outcome.status).toBe(303);
    expect(outcome.location).toBe("/poems");
  });

  it.each([
    ["absolute URL", "https://evil.example/steal"],
    [
      "protocol-relative, which browsers resolve to another host",
      "//evil.example/steal",
    ],
    [
      "backslash variant, treated as protocol-relative by browsers",
      "/\\evil.example/steal",
    ],
    ["scheme-less with leading slash", "//evil.example"],
    [
      "obfuscated double-slash inside a path segment",
      "/redirect//evil.example",
    ],
  ])(
    "refuses a redirect target that could leave the site (%s)",
    async (_label, target) => {
      const { outcome } = await runUnlockWithRedirect(target);

      // Kit forwards `location` verbatim into a Location header, so an unfiltered value here would hand the
      // freshly minted editor session cookie to an attacker's domain. The route must rewrite it instead.
      expect(outcome.location).toBe("/poems");
    },
  );

  it("keeps a same-origin root target rather than rejecting it", async () => {
    const { outcome } = await runUnlockWithRedirect("/");

    expect(outcome.location).toBe("/");
  });
});
