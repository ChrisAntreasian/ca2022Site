import type { PageServerLoad } from "./$types";
import { readPublicSouljuicerFile } from "#lib/editing/resources/souljuicer/souljuicer.server";
import { isEditorEnabled } from "#lib/editing/core/auth.server";

const defaultTitle = "the SoulJuicer";
const defaultMedium = "pencil";

export const load: PageServerLoad = async ({ params }) => {
  const { data: file } = await readPublicSouljuicerFile();
  const aid = parseInt(params.aid);

  const artPieces = [...file.data]
    // Copy before sorting so the store's own decoded array is never reordered in place.
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
