/**
 * Kit 3 types a `load` return as `void | <data>` (a load is allowed to render without data).
 * Route unit tests invoke the real `load` directly, so the `void` arm never happens at runtime -
 * this narrows it away once instead of casting at every property access in every test.
 */
export const loadResult = <T>(result: T | void): Exclude<T, void> => {
  if (!result) {
    throw new Error("load() returned no data");
  }
  return result as Exclude<T, void>;
};
