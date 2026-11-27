import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { readPublicQuintuplapusFile } from "#lib/editing/resources/quintuplapus/quintuplapus.server";
import { isEditorUnlockedForRequest } from "#lib/editing/core/session.server";

export const load: PageServerLoad = async ({ cookies, params }) => {
  const aid = parseInt(params.aid) || 2;
  const { data } = await readPublicQuintuplapusFile();
  const att = data.data[0].attributes;

  const omitIds = att.omit.data.map((d) => d.id);

  const artPieces = att.art_pieces.data
    .filter((p) => !omitIds.includes(p.id))
    .sort((a, b) => a.attributes.order - b.attributes.order);

  const artPiece = artPieces.find((p) => p.id === aid);
  if (!artPiece) {
    error(404, `No art piece with id ${aid}`);
  }
  const categoryTitle = att.title;

  return {
    categoryTitle,
    artPieces,
    artPiece,
    editorEnabled: isEditorUnlockedForRequest(cookies),
  };
};
