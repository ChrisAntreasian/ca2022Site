import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock SvelteKit runtime
vi.mock("$app/environment", () => ({
  browser: false,
  dev: true,
  building: false,
  version: "",
}));

vi.mock("$app/navigation", () => ({
  afterNavigate: vi.fn(),
  beforeNavigate: vi.fn(),
  goto: vi.fn(),
  invalidate: vi.fn(),
  invalidateAll: vi.fn(),
  preloadData: vi.fn(),
  preloadCode: vi.fn(),
}));

// Kit 3 deleted `$app/stores` in favour of `$app/state` (a plain reactive state object, so there
// are no `subscribe` fields to mock). The shapes mirror the getters of
// node_modules/@sveltejs/kit/src/runtime/app/state/client.svelte.js:65-150.
vi.mock("$app/state", () => ({
  page: {
    data: {},
    error: null,
    form: undefined,
    params: {},
    route: { id: null },
    shallow: false,
    state: {},
    status: 200,
    url: new URL("http://localhost/"),
  },
  navigating: {
    from: null,
    to: null,
    type: null,
    willUnload: null,
    delta: null,
    complete: null,
  },
  updated: {
    current: false,
    check: vi.fn(async () => false),
  },
}));

// Mock analytics
vi.mock("$lib/analytics", () => ({
  captureBehavior: vi.fn(),
  captureDetails: vi.fn(),
  captureClickThis: vi.fn(),
  initMixpanel: vi.fn(),
  initDistinctId: vi.fn(),
}));

// Mock history - removed clientNavigate mock to allow real testing

// Mock spacing utilities - removed to use actual implementation
