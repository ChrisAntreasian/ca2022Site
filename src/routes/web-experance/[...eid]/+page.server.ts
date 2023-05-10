import type { Item } from '$lib/Article/types';

import type { PageServerLoad } from './$types';
import * as D from "$data/web-experance.json"

export const load: PageServerLoad = async ({ params }) => {
	const d = D.data;
  const eid = parseInt(params.eid);
  const pageData = d.data[0];
	const pageDetails = pageData.attributes.page_details.data[0];

  const pageItem: Item = {
    id: -1,
    title: pageDetails.attributes.title,
    body: pageDetails.attributes.description,
    omitFromNav: true,
  };

  const workExpItems: ReadonlyArray<Item> = pageData.attributes.rich_links.data
    .sort((a, b) => a.attributes.position - b.attributes.position)
    .map(_ => ({
      id: _.id,
      title: _.attributes.title,
      body: _.attributes.body,
      logo: _.attributes.logo.data.attributes.url,
      link: _.attributes.link,
      secondLink: _.attributes.secondLink
      // screenShots: _.attributes.image.data.map(_ => _.attributes.url)
    }));

    return { 
    items: [pageItem, ...workExpItems], 
    item: workExpItems.filter((_: Item) => _.id === eid)[0] || pageItem 
  };
};
