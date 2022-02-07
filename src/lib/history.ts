import type { StrapiData } from "./types";

export const cleanUrlSlug = (str: string) => str.replace(/[^A-Za-z0-9]/g, "-").toLowerCase();
export const pushHistory = (url: string, slug: string) => {
  history.pushState({}, "", `${url}/${cleanUrlSlug(slug)}`);
  window.scrollTo({top: 0});
};
