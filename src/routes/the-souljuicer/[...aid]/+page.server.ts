import type { PageServerLoad } from "./$types";
import * as D from "$data/the-souljuicer.json";

export const load: PageServerLoad = async ({ params }) => {
  const d = D.data;
  const aid = parseInt(params.aid);

  let artPieces = d.data
    .sort((a, b) => a.attributes.order - b.attributes.order)
    .map((a) => ({
      ...a,
      attributes: {
        ...a.attributes,
        title: "the SoulJuicer",
        createdDate: new Date().toDateString(),
        medium: "pencil",
      },
    }));

  const artPiece = aid
    ? artPieces.filter((_) => _.id === aid)[0]
    : artPieces[0];

  return {
    categoryTitle: "the SoulJuicer",
    artPieces,
    artPiece,
  };
};
