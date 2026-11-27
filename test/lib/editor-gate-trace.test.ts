import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The DEV gate trace. Its whole purpose is to tell an operator which of the three gates closed the editor, so
 * the assertions here are about the gate named in the message - and about what the message must never contain,
 * since a log line is the one thing this codebase hands to a console it cannot sanitize afterwards.
 */

const KEY = "correct-stationary-key";
const SECRET = "test-signing-secret";
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

const configureEnv = (overrides: Record<string, string | undefined> = {}) => {
  env.ENABLE_CONTENT_EDITOR = "true";
  env.EDITOR_EDIT_KEY = KEY;
  env.EDITOR_SESSION_SECRET = SECRET;
  Object.assign(env, overrides);
};

/**
 * Vitest runs in Vite's dev environment, so `import.meta.env.DEV` is true here and the trace is live for every
 * test below. The production half of the guard cannot be simulated - Vite replaces the DEV branch statically at
 * build time rather than leaving a runtime flag to flip - so "silent outside dev" is asserted by inspecting the
 * source instead: see the `!import.meta.env.DEV` early return in `traceEditorGateClosed`.
 */

let infoSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  configureEnv();
  vi.resetModules();
  infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
});

const loadModule = async () => {
  vi.resetModules();
  return import("../../src/lib/editing/core/session.server");
};

const cookiesWith = (values: Record<string, string>) => {
  const store = new Map(Object.entries(values));
  return { get: (name: string) => store.get(name) };
};

describe("editor gate trace", () => {
  it("names the flag as the gate that closed the editor", async () => {
    configureEnv({ ENABLE_CONTENT_EDITOR: undefined });
    const { isEditorUnlockedForRequest } = await loadModule();

    expect(isEditorUnlockedForRequest(cookiesWith({}))).toBe(false);
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining("flag-off"));
  });

  it("names the missing edit key and points at the dev server restart", async () => {
    configureEnv({ EDITOR_EDIT_KEY: undefined });
    const { isEditorUnlockedForRequest } = await loadModule();

    expect(isEditorUnlockedForRequest(cookiesWith({}))).toBe(false);

    const message = infoSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(message).toContain("missing-edit-key");
    // The likeliest real cause: .env.local changed after `npm run dev` had already read it.
    expect(message).toContain("restart");
  });

  it("names the missing session and names the unlock route", async () => {
    const { isEditorUnlockedForRequest } = await loadModule();

    expect(isEditorUnlockedForRequest(cookiesWith({}))).toBe(false);

    const message = infoSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(message).toContain("no-session");
    expect(message).toContain("/_editor/unlock");
  });

  it("logs nothing for a request that is allowed an edit link", async () => {
    const mod = await loadModule();
    const session = mod.createEditorSession();

    expect(
      mod.isEditorUnlockedForRequest(cookiesWith({ [SESSION_NAME]: session })),
    ).toBe(true);
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it("never prints the edit key, the session cookie or the signing secret", async () => {
    const mod = await loadModule();
    const session = mod.createEditorSession();

    // Exercise all three gates with real values in play.
    configureEnv({ ENABLE_CONTENT_EDITOR: undefined });
    await loadModule().then((m) =>
      m.isEditorUnlockedForRequest(cookiesWith({})),
    );

    configureEnv({ EDITOR_EDIT_KEY: undefined });
    (await loadModule()).isEditorUnlockedForRequest(
      cookiesWith({ [SESSION_NAME]: session }),
    );

    (await loadModule()).isEditorUnlockedForRequest(
      cookiesWith({ [SESSION_NAME]: "not-a-real-session" }),
    );

    const logged = infoSpy.mock.calls.map((c) => c.join(" ")).join("\n");

    expect(logged).not.toContain(KEY);
    expect(logged).not.toContain(SECRET);
    // The genuine session was carried by one of these requests; it must not appear in any log line.
    expect(logged).not.toContain(session);
    expect(logged).not.toContain(session.split(".")[0]);
  });

  it("is dev-only, so a live deploy cannot be used to probe the gates", async () => {
    // Vite replaces the DEV branch statically at build time rather than leaving a runtime flag to flip, so this
    // guard is checked where it is guaranteed to hold: the source itself. A production bundle has no trace call
    // left to reach - the whole function body sits behind `if (!import.meta.env.DEV) return;`.
    const source = await import(
      /* @vite-ignore */ "../../src/lib/editing/core/session.server.ts?raw"
    );

    const traceBody = source.default.slice(
      source.default.indexOf("const traceEditorGateClosed"),
      source.default.indexOf("export const isEditorUnlockedForRequest"),
    );

    expect(traceBody).toContain("if (!import.meta.env.DEV)");

    // The trace is the only logging in this function, and the guard precedes it - so nothing after the guard can
    // log outside dev. (The file's other `console.error` belongs to `editorGate`, which must stay reachable in
    // prod because that path throws a 500 an operator has to be able to see.)
    const guarded = traceBody.slice(
      traceBody.indexOf("if (!import.meta.env.DEV)"),
    );
    expect(guarded).toContain("console.info");
    expect(guarded.match(/console\./g)).toHaveLength(1);
  });
});
