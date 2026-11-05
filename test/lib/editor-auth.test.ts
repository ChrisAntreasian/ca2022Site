import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Editor authentication gate. This is the boundary that keeps `ENABLE_CONTENT_EDITOR=true` in production from
 * meaning "anyone can mutate durable storage", so it gets its own coverage instead of riding along with page
 * tests that mock the seam wholesale.
 */

const KEY = "correct-stationary-key";
const SESSION_NAME = "editor_session";

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

const loadModule = async () => {
  vi.resetModules();
  return import("../../src/lib/editing/core/session.server");
};

const cookiesWith = (values: Record<string, string>) => {
  const store = new Map(Object.entries(values));
  return {
    get: (name: string) => store.get(name),
    set: (name: string, value: string) => {
      store.set(name, value);
    },
  };
};

const configureEditor = (
  overrides: Record<string, string | undefined> = {},
) => {
  env.ENABLE_CONTENT_EDITOR = "true";
  env.EDITOR_EDIT_KEY = KEY;
  env.EDITOR_SESSION_SECRET = "test-signing-secret";
  Object.assign(env, overrides);
};

describe("editor session server", () => {
  beforeEach(() => {
    configureEditor();
    vi.resetModules();
  });

  it("mints a session that passes the gate it created", async () => {
    const { createEditorSession, isEditorUnlocked } = await loadModule();
    const session = createEditorSession();
    const unlocked = isEditorUnlocked(cookiesWith({ [SESSION_NAME]: session }));

    expect(unlocked).toBe(true);
  });

  it("rejects a forged cookie that carries valid-looking content", async () => {
    const { createEditorSession, isEditorUnlocked } = await loadModule();
    const session = createEditorSession();
    const parts = session.split(".");
    const forged = `${parts[0]}.0000000000000000000000000000000000000000000000000000000000000000`;
    const unlocked = isEditorUnlocked(cookiesWith({ [SESSION_NAME]: forged }));

    // Same shape and a plausible expiry, wrong signature: the payload proves nothing on its own.
    expect(unlocked).toBe(false);
  });

  it("rejects a session signed with a different secret", async () => {
    const first = await loadModule();
    const foreignSession = first.createEditorSession();

    configureEditor({ EDITOR_SESSION_SECRET: "a-completely-different-secret" });
    const rotated = await loadModule();
    const unlocked = rotated.isEditorUnlocked(
      cookiesWith({ [SESSION_NAME]: foreignSession }),
    );

    expect(unlocked).toBe(false);
  });

  it("rejects an expired session even when the signature is intact", async () => {
    const { isEditorUnlocked } = await loadModule();
    const body = Buffer.from(
      JSON.stringify({ unlockedAt: Date.now(), expiresAt: 1 }),
    ).toString("base64url");

    // Signed with the live secret, so only the expiry is wrong.
    const { createHmac } = await import("node:crypto");
    const signature = createHmac("sha256", "test-signing-secret")
      .update(body)
      .digest("hex");
    const value = body + "." + signature;
    const unlocked = isEditorUnlocked(cookiesWith({ [SESSION_NAME]: value }));

    expect(unlocked).toBe(false);
  });
  it("refuses to unlock when the editor flag is off, even with a valid session", async () => {
    configureEditor({ ENABLE_CONTENT_EDITOR: "false" });
    const { createEditorSession, requireEditorAccess } = await loadModule();
    const session = createEditorSession();

    expect(() =>
      requireEditorAccess(cookiesWith({ [SESSION_NAME]: session })),
    ).toThrowError(
      expect.objectContaining({ status: 403 }) as unknown as Error,
    );
  });

  it("refuses to unlock when no edit key is configured", async () => {
    configureEditor({ EDITOR_EDIT_KEY: undefined });
    const { requireEditorAccess } = await loadModule();

    expect(() => requireEditorAccess(cookiesWith({}))).toThrowError(
      expect.objectContaining({ status: 500 }) as unknown as Error,
    );
  });
  it("refuses to unlock with a missing, blank or tampered session", async () => {
    const { requireEditorAccess } = await loadModule();

    const missingSession = {};
    const blankSession = { [SESSION_NAME]: "" };
    const garbageSession = { [SESSION_NAME]: "not-a-session" };
    const unrelatedCookie = { otherCookie: "value" };

    for (const values of [
      missingSession,
      blankSession,
      garbageSession,
      unrelatedCookie,
    ]) {
      expect(() => requireEditorAccess(cookiesWith(values))).toThrowError(
        expect.objectContaining({ status: 403 }) as unknown as Error,
      );
    }
  });

  it("accepts a valid session for the gate", async () => {
    const { createEditorSession, requireEditorAccess } = await loadModule();
    const session = createEditorSession();

    expect(() =>
      requireEditorAccess(cookiesWith({ [SESSION_NAME]: session })),
    ).not.toThrow();
  });
  it("compares the edit key without reporting whether one is configured", async () => {
    configureEditor({ EDITOR_EDIT_KEY: undefined });
    const { verifyEditorEditKey } = await loadModule();

    // A misconfigured deploy must not become probeable through the unlock form.
    expect(verifyEditorEditKey(KEY)).toBe(false);
    expect(verifyEditorEditKey("")).toBe(false);
    expect(verifyEditorEditKey(null as unknown as string)).toBe(false);
  });

  it("verifies the edit key exactly and rejects near misses", async () => {
    const { verifyEditorEditKey } = await loadModule();

    expect(verifyEditorEditKey(KEY)).toBe(true);
    expect(verifyEditorEditKey(KEY + " ")).toBe(false);
    expect(verifyEditorEditKey(KEY.slice(0, -1))).toBe(false);
    expect(verifyEditorEditKey(KEY.toUpperCase())).toBe(false);
  });

  it("treats a configured-but-blank key as unconfigured", async () => {
    configureEditor({ EDITOR_EDIT_KEY: "   " });
    const { isEditorConfigured, verifyEditorEditKey } = await loadModule();

    expect(isEditorConfigured()).toBe(false);
    expect(verifyEditorEditKey("   ")).toBe(false);
  });
  it("hides edit links from a visitor who has not unlocked the editor", async () => {
    const { createEditorSession, isEditorUnlockedForRequest } =
      await loadModule();
    const session = createEditorSession();

    expect(isEditorUnlockedForRequest(cookiesWith({}))).toBe(false);
    expect(
      isEditorUnlockedForRequest(cookiesWith({ [SESSION_NAME]: session })),
    ).toBe(true);
  });

  it("keeps edit links off when the flag is on but no key exists", async () => {
    configureEditor({ EDITOR_EDIT_KEY: undefined });
    const { createEditorSession, isEditorUnlockedForRequest } =
      await loadModule();
    const session = createEditorSession();

    expect(
      isEditorUnlockedForRequest(cookiesWith({ [SESSION_NAME]: session })),
    ).toBe(false);
  });

  it("flags a missing session secret instead of failing the editor", async () => {
    configureEditor({ EDITOR_SESSION_SECRET: undefined });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { createEditorSession, isEditorUnlocked } = await loadModule();

    // Ephemeral signing still works for the current process; it just cannot survive a restart.
    expect(
      isEditorUnlocked(cookiesWith({ [SESSION_NAME]: createEditorSession() })),
    ).toBe(true);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("EDITOR_SESSION_SECRET"),
    );
    errorSpy.mockRestore();
  });

  it("marks the session cookie httpOnly and path-scoped to the whole site", async () => {
    const { editorSessionCookieOptions, editorSessionDeleteOptions } =
      await loadModule();

    expect(editorSessionCookieOptions.httpOnly).toBe(true);
    expect(editorSessionCookieOptions.sameSite).toBe("lax");
    expect(editorSessionCookieOptions.path).toBe("/");
    expect(editorSessionCookieOptions.maxAge).toBeGreaterThan(0);
    // Deleting must use the same attributes, or the browser keeps a copy it cannot overwrite.
    expect(editorSessionDeleteOptions.httpOnly).toBe(true);
    expect(editorSessionDeleteOptions.path).toBe("/");
  });
});
