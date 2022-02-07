import type { StrapiData } from "./types";

export const cleanUrlSlug = (str: string) => str.replace(/[^A-Za-z0-9]/g, "-").toLowerCase();
export const clientNavigate = (scroll: boolean) => (url: string, slug: string) => {
  history.pushState({}, "", `${url}/${cleanUrlSlug(slug)}`);
  scroll && window.scrollTo({top: 0});
};
