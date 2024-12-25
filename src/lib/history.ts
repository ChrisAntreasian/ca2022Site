import { pushState } from "$app/navigation";

export const cleanUrlSlug = (slug: string) => {
  let str = slug.replace(/[^A-Za-z0-9]/g, "-")
    .toLowerCase()
    .split("--")
    .reduce((acc, v) => `${acc}-${v}`);

  if (str[0] === "-") str = str.substring(1, str.length);
  if (str[str.length - 1] === "-") str = str.substring(0, str.length - 1);

  return str;
};

export const clientNavigate = (scroll: boolean) => (url: string, slug?: string) => {
  const s = slug ? `/${cleanUrlSlug(slug)}` : "";
  pushState(`${url}${s}`, {});
  if (scroll) {
    window.scrollTo({ top: 0 });
  } 
};
