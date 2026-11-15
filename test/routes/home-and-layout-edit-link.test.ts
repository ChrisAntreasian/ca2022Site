import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeCookies } from "./fakeCookies";
import { loadResult } from "./loadResult";

/**
 * The public "Edit" links the site offers. These two loaders are the only thing standing between a visitor and
 * an editor URL they can guess, so what matters is not that a link exists but that it exists only for a request
 * that has actually unlocked the editor - which is why the real gate drives these tests rather than a mock.
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

const configureEnv = (overrides: Record<string, string | undefined> = {}) => {
  env.ENABLE_CONTENT_EDITOR = "true";
  env.EDITOR_EDIT_KEY = KEY;
  env.EDITOR_SESSION_SECRET = "test-signing-secret";
  Object.assign(env, overrides);
};

/** The gate module, freshly imported per test so it reads the env state configured for that test. */
const loadGate = async () => {
  vi.resetModules();
  return import("../../src/lib/editing/core/session.server");
};

vi.doMock("#lib/analytics", () => ({
  captureBehavior: vi.fn(),
  captureDetails: vi.fn(),
  captureClickThis: vi.fn(),
  initMixpanel: vi.fn(),
  initDistinctId: vi.fn(async () => undefined),
}));

const landingFile = () => ({
  name: "landing",
  timestamp: 1,
  data: {
    data: [
      {
        id: 1,
        attributes: {
          title: "Home",
          page_details: {
            data: [
              {
                id: 5,
                attributes: {
                  title: "Welcome!",
                  description: "Intro.",
                  link: null,
                },
              },
              {
                id: 6,
                attributes: {
                  title: "Poems",
                  description: "Read.",
                  link: "/poems",
                },
              },
            ],
          },
        },
      },
    ],
  },
});

const layoutFile = () => ({
  name: "layout",
  timestamp: 1,
  data: {
    data: [
      {
        attributes: {
          title: "Christopher Antreasian",
          image: { data: { attributes: { url: "logo.png" } } },
        },
      },
    ],
  },
});

vi.doMock("#lib/content.server", () => ({
  readPublicFile: async (name: string) =>
    name === "landing" ? landingFile() : layoutFile(),
}));

const loadHome = async (cookies) => {
  vi.resetModules();
  const route = await import("../../src/routes/+page.server");
  return loadResult(await route.load({ cookies } as never));
};

const loadLayout = async (cookies) => {
  vi.resetModules();
  const route = await import("../../src/routes/+layout.server");
  return loadResult(await route.load({ cookies } as never));
};

describe("public edit links follow the editor gate", () => {
  beforeEach(() => {
    configureEnv();
    vi.resetModules();
  });

  it("offers the home page editor link only to an unlocked request", async () => {
    const gate = await loadGate();
    const session = gate.createEditorSession();

    const locked = await loadHome(fakeCookies());
    expect(locked.editorEnabled).toBe(false);
    // The href is still computed - the page decides whether to render it, so a locked visitor simply sees no link.
    expect(locked.landingEditorHref).toBe("/landing/edit/5");

    const unlocked = await loadHome(fakeCookies({ [SESSION_NAME]: session }));
    expect(unlocked.editorEnabled).toBe(true);
    expect(unlocked.landingEditorHref).toBe("/landing/edit/5");
  });

  it("offers the layout editor link from the root layout only when unlocked", async () => {
    const gate = await loadGate();
    const session = gate.createEditorSession();

    expect((await loadLayout(fakeCookies())).editorEnabled).toBe(false);
    expect(
      (await loadLayout(fakeCookies({ [SESSION_NAME]: session })))
        .editorEnabled,
    ).toBe(true);
  });

  it("keeps both links off when the flag is on but no edit key exists", async () => {
    configureEnv({ EDITOR_EDIT_KEY: undefined });

    const gate = await loadGate();
    const session = gate.createEditorSession();
    const cookies = fakeCookies({ [SESSION_NAME]: session });

    expect((await loadHome(cookies)).editorEnabled).toBe(false);
    expect((await loadLayout(cookies)).editorEnabled).toBe(false);
  });

  it("keeps both links off when the flag is off", async () => {
    configureEnv({ ENABLE_CONTENT_EDITOR: "false" });

    const gate = await loadGate();
    const session = gate.createEditorSession();
    const cookies = fakeCookies({ [SESSION_NAME]: session });

    expect((await loadHome(cookies)).editorEnabled).toBe(false);
    expect((await loadLayout(cookies)).editorEnabled).toBe(false);
  });

  it("leaves the home page content untouched by the new fields", async () => {
    const result = await loadHome(fakeCookies());

    expect(result.intro.map((section) => section.id)).toEqual([5]);
    expect(result.links.map((section) => section.id)).toEqual([6]);
  });
});
