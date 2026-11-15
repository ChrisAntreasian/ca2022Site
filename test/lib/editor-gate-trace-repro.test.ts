import { beforeEach, describe, expect, it, vi } from "vitest";

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

vi.doMock("#lib/error", () => ({
  e403: (message: string) => ({ status: 403, message }),
  e500: (message: string) => ({ status: 500, message }),
}));

const cookies = (session: string | undefined) => ({
  get: () => session,
});

/**
 * Server-side reproduction of the browser symptom. `isEditorUnlockedForRequest` is what every public page
 * calls to decide whether to render an "Edit" link, and it is also what emits the `[editor] Edit link hidden`
 * trace - so these tests drive the same three gates a dev sees in a terminal, and prove the trace names the
 * gate that closed the editor rather than merely hiding the link.
 *
 * The gate module is re-imported per test because its env reads are live getters: with `isolate: false` the
 * registry is shared across files, so a fresh import is what makes each test's own `env` values authoritative
 * rather than whichever factory another file registered last.
 */
const loadGate = () => import("../../src/lib/editing/core/session.server");

describe("editor gate traces which condition failed", () => {
  beforeEach(() => {
    vi.resetModules();
    env.ENABLE_CONTENT_EDITOR = undefined;
    env.EDITOR_EDIT_KEY = undefined;
    env.EDITOR_SESSION_SECRET = undefined;
  });

  it("reports flag-off when ENABLE_CONTENT_EDITOR is not 'true'", async () => {
    const gate = await loadGate();
    env.ENABLE_CONTENT_EDITOR = undefined;
    env.EDITOR_EDIT_KEY = "correct-stationary-key";
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    expect(gate.isEditorUnlockedForRequest(cookies(undefined))).toBe(false);
    expect(info).toHaveBeenCalledWith(
      expect.stringContaining("Edit link hidden: flag-off"),
    );
  });

  it("reports missing-edit-key when the flag is on but no key is configured", async () => {
    const gate = await loadGate();
    env.ENABLE_CONTENT_EDITOR = "true";
    env.EDITOR_EDIT_KEY = undefined;
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    expect(gate.isEditorUnlockedForRequest(cookies(undefined))).toBe(false);
    expect(info).toHaveBeenCalledWith(
      expect.stringContaining("Edit link hidden: missing-edit-key"),
    );
  });

  it("reports no-session when the flag and key are in place but no cookie was minted", async () => {
    const gate = await loadGate();
    env.ENABLE_CONTENT_EDITOR = "true";
    env.EDITOR_EDIT_KEY = "correct-stationary-key";
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    expect(gate.isEditorUnlockedForRequest(cookies(undefined))).toBe(false);
    expect(info).toHaveBeenCalledWith(
      expect.stringContaining("Edit link hidden: no-session"),
    );
  });

  it("admits a genuine session and traces nothing", async () => {
    const gate = await loadGate();
    env.ENABLE_CONTENT_EDITOR = "true";
    env.EDITOR_EDIT_KEY = "correct-stationary-key";
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const unlocked = cookies(gate.createEditorSession());

    expect(gate.isEditorUnlockedForRequest(unlocked)).toBe(true);
    expect(info).not.toHaveBeenCalled();
  });
});
