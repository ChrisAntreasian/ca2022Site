import type { Item } from "$lib/Article/types";

import type { PageServerLoad } from "./$types";
import * as D from "$data/poems.json";

export const load: PageServerLoad = async ({ params }) => {
  const d = D.data;
  const pid =
    parseInt(params.pid) ||
    d.data[Math.floor(Math.random() * d.data.length)].id;

  const items = d.data
    .sort((a, b) => a.attributes.position - b.attributes.position)
    .reduce(
      (acc: ReadonlyArray<Item>, i) => [
        ...acc,
        {
          id: i.id,
          title: i.attributes.title,
          body: i.attributes.body,
        },
      ],
      [],
    );

  const item = items.filter((i: Item) => i.id === pid)[0];

  return { items, item };
};
