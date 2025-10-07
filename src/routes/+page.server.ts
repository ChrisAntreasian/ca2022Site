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
          intro: StrapiPageDetails[0][];
          links: StrapiPageDetails[0][];
        },
        d: StrapiPageDetails[0],
      ) => {
        if (introIds.includes(d.id)) {
          acc.intro = [...acc.intro, d];
        } else {
          acc.links = [...acc.links, d];
        }
        return acc;
      },
      {
        intro: [] as StrapiPageDetails[0][],
        links: [] as StrapiPageDetails[0][],
      },
    ),
  };
};
