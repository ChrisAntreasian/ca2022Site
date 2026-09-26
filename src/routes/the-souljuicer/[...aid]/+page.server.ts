import type { PageServerLoad } from "./$types";
import * as D from "$data/the-souljuicer.json";
import { isEditorEnabled } from "$lib/editing/auth.server";

const defaultTitle = "the SoulJuicer";
const defaultMedium = "pencil";

export const load: PageServerLoad = async ({ params }) => {
  const d = D.data;
  const aid = parseInt(params.aid);

  const artPieces = d.data
    .sort((a, b) => a.attributes.order - b.attributes.order)
    .map((a) => {
      const attributes = a.attributes as typeof a.attributes & {
        title?: string;
        createdDate?: string;
        medium?: string;
      };

      return {
        ...a,
        attributes: {
          ...attributes,
          title: attributes.title ?? defaultTitle,
          createdDate: attributes.createdDate ?? attributes.createdAt,
          medium: attributes.medium ?? defaultMedium,
        },
      };
    });

  const artPiece = aid
    ? artPieces.filter((p) => p.id === aid)[0]
    : artPieces[0];

  return {
    categoryTitle: defaultTitle,
    artPieces,
    artPiece,
    editorEnabled: isEditorEnabled(),
  };
};
