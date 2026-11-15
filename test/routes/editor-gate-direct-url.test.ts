import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeCookies } from "./fakeCookies";
import { loadResult } from "./loadResult";

/**
 * The direct-URL guarantee.
 *
 * Knowing `/layout/edit` or `/landing/edit/5` is not access: every editor `load` calls `requireEditorAccess`
 * before it reads a byte of content, so an unauthenticated request never reaches the data layer. These tests
 * run each route's REAL `load` against the REAL gate with only the storage seam stubbed - mocking the gate
 * itself would assert nothing about what happens when someone types the URL into an address bar.
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

/** The failure every stub reports if a gate ever fails open and lets a request reach storage. */
const reachedStorage = () => {
  readCount += 1;
  throw new Error("storage seam reached by an unauthenticated editor request");
};

/**
 * Every storage seam an editor route touches. Each one counts its calls, so the assertion on `readCount` is
 * what catches a gate that failed open - an unconsumed stub would otherwise just hand out content quietly.
 */
let readCount = 0;

const stubStorage = () => {
  readCount = 0;

  vi.doMock("#lib/content.server", () => ({
    readPublicFile: async () => reachedStorage(),
  }));

  vi.doMock("#lib/editing/core/store.server", () => ({
    readDataFile: async () => reachedStorage(),
    writeDataFile: async () => reachedStorage(),
    ensureBaselineSnapshot: async () => {
      readCount += 1;
    },
    isBaselineSnapshotPresent: () => true,
  }));

  vi.doMock("#lib/editing/core/media.server", () => ({
    saveEditorMedia: async () => reachedStorage(),
  }));
};

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
            ],
          },
        },
      },
    ],
  },
});

/** The gate module, freshly imported per test so it reads the env state configured for that test. */
const loadGate = async () => {
  vi.resetModules();
  return import("../../src/lib/editing/core/session.server");
};

/** Run `/layout/edit`'s real load with no session, against the real gate. */
const loadLayoutEdit = async (cookies = fakeCookies()) => {
  stubStorage();
  vi.doMock("#lib/editing/resources/layout/layout.server", () => ({
    readLayoutFile: async () => {
      readCount += 1;
      return layoutFile();
    },
    ensureLayoutBaselineSnapshot: async () => {
      readCount += 1;
    },
    saveLayoutEditorValue: async () => reachedStorage(),
  }));

  vi.resetModules();
  const route = await import("../../src/routes/layout/edit/+page.server");
  // Kit 3 types a load as `void | <data>`; these tests always reach real data, so narrowing here keeps the
  // assertions below typechecked instead of silencing them with a cast.
  return loadResult(
    await route.load({
      cookies,
      url: new URL("http://localhost/layout/edit"),
    } as never),
  );
};

/** Run `/landing/edit/5`'s real load with no session, against the real gate. */
const loadLandingEdit = async (cookies = fakeCookies()) => {
  stubStorage();
  vi.doMock("#lib/editing/resources/landing/landing.server", () => ({
    readLandingFile: async () => {
      readCount += 1;
      return landingFile();
    },
    ensureLandingBaselineSnapshot: async () => {
      readCount += 1;
    },
    saveLandingSectionEditorValue: async () => reachedStorage(),
  }));

  vi.resetModules();
  const route =
    await import("../../src/routes/landing/edit/[...sid]/+page.server");
  return loadResult(
    await route.load({
      cookies,
      params: { sid: "5" },
      url: new URL("http://localhost/landing/edit/5"),
    } as never),
  );
};

/** The routes under test, so each gate state is asserted for both without repeating bodies. */
const editorRoutes = [
  { name: "/layout/edit", load: loadLayoutEdit },
  { name: "/landing/edit/5", load: loadLandingEdit },
] as const;

describe("editor routes reject an unauthenticated direct request", () => {
  beforeEach(() => {
    configureEnv();
    stubStorage();
    vi.resetModules();
  });

  it.each(editorRoutes)(
    "refuses $name with the flag off, without touching storage",
    async ({ load }) => {
      configureEnv({ ENABLE_CONTENT_EDITOR: undefined });

      await expect(load()).rejects.toMatchObject({ status: 403 });
      expect(readCount).toBe(0);
    },
  );

  it.each(editorRoutes)(
    "reports a server fault for $name when the flag is on but no edit key exists",
    async ({ load }) => {
      configureEnv({ EDITOR_EDIT_KEY: undefined });

      // 500 rather than 403: the deploy is broken, and reporting that to a visitor would advertise it.
      await expect(load()).rejects.toMatchObject({ status: 500 });
      expect(readCount).toBe(0);
    },
  );

  it.each(editorRoutes)(
    "refuses $name when the editor is configured but no session cookie was presented",
    async ({ load }) => {
      await expect(load()).rejects.toMatchObject({ status: 403 });
      expect(readCount).toBe(0);
    },
  );

  it("refuses both routes for a forged session, not merely an absent one", async () => {
    const gate = await loadGate();
    const session = gate.createEditorSession();
    const [body] = session.split(".");
    const forged = `${body}.${"0".repeat(64)}`;

    // Same payload, same expiry, wrong signature.
    await expect(
      loadLayoutEdit(fakeCookies({ [SESSION_NAME]: forged })),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      loadLandingEdit(fakeCookies({ [SESSION_NAME]: forged })),
    ).rejects.toMatchObject({ status: 403 });
    expect(readCount).toBe(0);
  });

  it("admits a genuine session, so the refusals above are about the session and not the stub", async () => {
    const gate = await loadGate();
    const session = gate.createEditorSession();
    const cookies = fakeCookies({ [SESSION_NAME]: session });

    expect(gate.isEditorUnlockedForRequest(cookies)).toBe(true);

    const layoutResult = await loadLayoutEdit(cookies);
    const landingResult = await loadLandingEdit(cookies);

    expect(layoutResult.editorEnabled).toBe(true);
    expect(landingResult.editorEnabled).toBe(true);
    expect(readCount).toBeGreaterThan(0);
  });
});
