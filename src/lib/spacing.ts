export const rem = 16;

export const contextHeightKey = "componentDimensions";

export const wrapperWidth = 75 * rem;
export const mqBreakPoint = 768;
export const fromRem = (v: number) => v * rem;
export const toRem = (v: number) => v / rem;

export type LayoutElemH = {
  getHeaderHeight: () => number;
  getFooterHeight: () => number;
};
