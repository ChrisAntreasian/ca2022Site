/**
 * Minimal stand-in for SvelteKit's `Cookies` bag, for page-server tests that call `load` or an action
 * directly instead of going through the router. Pages now read editor session state from cookies, so every
 * such test has to supply something; keeping it here avoids a dozen ad-hoc `{ get: () => undefined }` literals.
 */
export const fakeCookies = (initial: Record<string, string> = {}) => {
  const store = new Map(Object.entries(initial));

  return {
    get: (name: string) => store.get(name),
    set: (name: string, value: string) => {
      store.set(name, value);
    },
    delete: (name: string) => {
      store.delete(name);
    },
  };
};

/** A cookies bag that already holds an unlocked editor session under `name`. */
export const unlockedCookies = (name: string, value = "valid-session") =>
  fakeCookies({ [name]: value });
