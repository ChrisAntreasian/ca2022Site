import type { Item } from "#lib/Article/types";
import { isEditorUnlockedForRequest } from "#lib/editing/core/session.server";

import type { PageServerLoad } from "./$types";
import { readPublicWebExperienceFile } from "#lib/editing/resources/web-experience/web-experience.server";

export const load: PageServerLoad = async ({ cookies, params }) => {
  const { data } = await readPublicWebExperienceFile();
  const pageData = data.data[0];
  const pageDetails = pageData.attributes.page_details.data[0];
  const eid = params.eid ? parseInt(params.eid) : -1;

  const pageItem: Item = {
    id: -1,
    title: pageDetails.attributes.title,
    body: pageDetails.attributes.description,
    omitFromNav: true,
  };

  const workExpItems: ReadonlyArray<Item> = (
    pageData.attributes.rich_links.data ?? []
  )
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => a.attributes.position - b.attributes.position)
    .map((item) => ({
      id: item.id,
      title: item.attributes.title,
      body: item.attributes.body,
      logo: item.attributes.logo.data?.attributes.url ?? undefined,
      link: item.attributes.link,
      secondLink: item.attributes.secondLink ?? undefined,
      images: (item.attributes.image.data ?? [])
        .filter((img): img is NonNullable<typeof img> => Boolean(img))
        .map((img) => {
          // `formats` is present on a Strapi image but the editor's own uploaded assets only carry
          // `url`, so the small variant is read defensively exactly as the resource module reads it.
          const attributes = img.attributes as typeof img.attributes & {
            formats?: { small?: { url?: string } };
          };

          return {
            id: img.id,
            small: attributes.formats?.small?.url ?? attributes.url,
            large: attributes.url,
          };
        }),
    }));

  return {
    items: [pageItem, ...workExpItems],
    item: workExpItems.filter((item: Item) => item.id === eid)[0] || pageItem,
    editorEnabled: isEditorUnlockedForRequest(cookies),
  };
};
