export const cleanUrlSlug = (_: string) => {
  let str = _
    .replace(/[^A-Za-z0-9]/g, "-")
    .toLowerCase()
    .split("--")
    .reduce((acc, _) => `${acc}-${_}`);
  
  if (str[0] === "-") str = str.substring(1, str.length);
  if (str[str.length - 1] === "-") str = str.substring(0, str.length - 1);

  return str;
};

export const clientNavigate = (scroll: boolean) => (url: string, slug: string) => {
  history.pushState({}, "", `${url}/${cleanUrlSlug(slug)}`);
  scroll && window.scrollTo({top: 0});
};
