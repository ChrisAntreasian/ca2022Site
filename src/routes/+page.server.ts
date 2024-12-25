import type { PageServerLoad } from "./$types";
import type { StrapiPageDetails } from "$lib/typing/page";
import * as D from "$data/landing.json";

const introIds = [5];

export const load: PageServerLoad = async () => {
  const d = D.data;
  const attrs = d.data[0].attributes;

  return {
    ...attrs.page_details.data.reduce(
      (
        acc: {
          intro: StrapiPageDetails;
          links: StrapiPageDetails;
        },
        d: StrapiPageDetails[0],
      ) => {
        if (introIds.includes(d.id)) {
          acc.intro.push(d);
        } else {
          acc.links.push(d);
        }
        return acc;
      },
      {
        intro: [],
        links: [],
      },
    ),
  };
};
