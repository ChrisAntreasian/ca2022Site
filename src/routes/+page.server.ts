import type { PageServerLoad } from "./$types";
import type { StrapiPageDetails } from "#lib/typing/page";
import { readPublicFile } from "#lib/content.server";
import { landingEditorPath } from "#lib/editing/resources/landing/landing-editor";
import { isEditorUnlockedForRequest } from "#lib/editing/core/session.server";

const introIds = [5];

/** The home page's landing intro section, whose editor route is `/landing/edit/<id>`. */
const landingEditorSectionId = 5;

/** The shape of `landing.json` / its S3 copy: the outer store envelope wraps the Strapi payload. */
type LandingFile = {
  name: string;
  timestamp: number;
  data: {
    data: { id: number; attributes: Record<string, unknown> }[];
  };
};

export const load: PageServerLoad = async ({ cookies }) => {
  const file = await readPublicFile<LandingFile>("landing");
  const attrs = file.data.data[0].attributes as {
    page_details: { data: StrapiPageDetails[0][] };
  };

  return {
    editorEnabled: isEditorUnlockedForRequest(cookies),
    landingEditorHref: landingEditorPath(landingEditorSectionId),
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
