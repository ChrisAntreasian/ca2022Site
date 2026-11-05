import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import * as D from "#data/the-quintuplapus.json";
import { isEditorEnabled } from "#lib/editing/core/auth.server";

export const load: PageServerLoad = async ({ params }) => {
  const aid = parseInt(params.aid) || 2;
  const d = D.data;
  const att = d.data[0].attributes;

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
    editorEnabled: isEditorEnabled(),
  };
};
