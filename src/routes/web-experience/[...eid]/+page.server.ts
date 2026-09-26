import type { Item } from "$lib/Article/types";
import { isEditorEnabled } from "$lib/editing/core/auth.server";

import type { PageServerLoad } from "./$types";
import * as D from "$data/web-experience.json";

export const load: PageServerLoad = async ({ params }) => {
  const d = D.data;
  const pageData = d.data[0];
  const pageDetails = pageData.attributes.page_details.data[0];
  const eid = params.eid ? parseInt(params.eid) : -1;

  const pageItem: Item = {
    id: -1,
    title: pageDetails.attributes.title,
    body: pageDetails.attributes.description,
    omitFromNav: true,
  };

  const workExpItems: ReadonlyArray<Item> = (pageData.attributes.rich_links.data ?? [])
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
        .map((img) => ({
        id: img.id,
        small: img.attributes.formats.small.url,
        large: img.attributes.url,
        })),
    }));

  return {
    items: [pageItem, ...workExpItems],
    item: workExpItems.filter((item: Item) => item.id === eid)[0] || pageItem,
    editorEnabled: isEditorEnabled(),
  };
};
