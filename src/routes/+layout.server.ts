import type { LayoutServerLoad } from "./$types";
import { readPublicFile } from "#lib/content.server";
import { initDistinctId } from "#lib/analytics";
import { isEditorUnlockedForRequest } from "#lib/editing/core/session.server";

const shortenString = (_: string) => {
  const a = _.split(" ");
  return `${a[0].charAt(0)}. ${a[1]}`;
};

/** The shape of `layout.json` / its S3 copy: the outer store envelope wraps the Strapi payload. */
type LayoutFile = {
  name: string;
  timestamp: number;
  data: {
    data: { attributes: { image: string; title: string } }[];
  };
};

export const load: LayoutServerLoad = async ({ cookies }) => {
  const file = await readPublicFile<LayoutFile>("layout");
  const d = file.data;
  await initDistinctId(cookies);

  return {
    logo: d.data[0].attributes.image,
    title: d.data[0].attributes.title,
    mobileTitle: shortenString(d.data[0].attributes.title),
    editorEnabled: isEditorUnlockedForRequest(cookies),
  };
};
