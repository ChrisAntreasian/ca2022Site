import { pushState } from "$app/navigation";

export const cleanUrlSlug = (slug: string) => {
  return slug
    .replace(/[^A-Za-z0-9]/g, "-")
    .toLowerCase()
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
};

export const clientNavigate = (scroll: boolean) => (url: string, slug?: string) => {
  let finalUrl = url;
  
  if (slug !== undefined) {
    const cleanedSlug = cleanUrlSlug(slug);
    if (cleanedSlug || slug === '') {
      if (url === '/') {
        finalUrl = `/${cleanedSlug}`;
      } else {
        finalUrl = `${url}/${cleanedSlug}`;
      }
    }
  }
  
  pushState(finalUrl, {});
  if (scroll) {
    window.scrollTo({ top: 0 });
  } 
};
