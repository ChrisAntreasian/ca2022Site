import { Schema } from "effect";

import type { EditorDefinition } from "../../core/definitions";

/**
 * A single home-page section. Only `title`, `description` and `link` are editable; the section `id` is
 * preserved because `+page.server.ts` classifies intro vs link sections by id, and the image record is
 * left untouched so existing consumers of the raw file keep working. `link` is kept as a plain string in
 * the editor value (empty means "no link") so form binding stays simple; it maps back to null on write.
 */
export const landingSectionC = Schema.Struct({
  id: Schema.Number,
  title: Schema.String,
  description: Schema.String,
  link: Schema.String,
});

export type LandingSection = Schema.Schema.Type<typeof landingSectionC>;

export const landingEditorValueC = Schema.Struct({
  sections: Schema.Array(landingSectionC),
});

export type LandingEditorValue = Schema.Schema.Type<typeof landingEditorValueC>;

/** Mirrors `landing.json`: envelope wrapping a single page entry whose `page_details` hold the sections. */
export const landingFileC = Schema.Struct({
  name: Schema.String,
  timestamp: Schema.Number,
  data: Schema.Struct({
    data: Schema.Array(
      Schema.Struct({
        id: Schema.Number,
        attributes: Schema.Struct({
          title: Schema.optional(Schema.String),
          page_details: Schema.Struct({
            data: Schema.Array(
              Schema.Struct({
                id: Schema.Number,
                attributes: Schema.Struct({
                  title: Schema.String,
                  description: Schema.String,
                  link: Schema.optional(Schema.NullOr(Schema.String)),
                }),
              }),
            ),
          }),
        }),
      }),
    ),
  }),
});

export type LandingFile = Schema.Schema.Type<typeof landingFileC>;

export const landingEditorDefinition = {
  key: "landing",
  label: "Home Page",
  schema: landingEditorValueC,
  fields: [
    { name: "title", label: "Section title", kind: "text", required: true },
    {
      name: "description",
      label: "Section body",
      kind: "textarea",
      placeholder: "Intro text or link caption",
      required: true,
    },
    { name: "link", label: "Link", kind: "text" },
  ],
  createDefault: (): LandingEditorValue => ({ sections: [] }),
} satisfies EditorDefinition<LandingEditorValue>;

export const toLandingEditorValue = (file: LandingFile): LandingEditorValue => {
  const page = file.data.data?.[0];

  if (!page) return landingEditorDefinition.createDefault();

  return {
    sections: (page.attributes.page_details?.data ?? []).map((section) => ({
      id: section.id,
      title: section.attributes.title,
      description: section.attributes.description,
      link: section.attributes.link ?? "",
    })),
  };
};

/**
 * Write editable fields back onto each section while keeping the section's identity and every other
 * attribute (image, timestamps) intact. Sections are matched by id; unknown ids are ignored so the file
 * cannot drift from what the loader expects.
 */
export const upsertLandingEditorValue = (
  file: LandingFile,
  value: LandingEditorValue,
  now = new Date(),
): LandingFile => {
  const page = file.data.data?.[0];

  if (!page) return file;

  const editsById = new Map(
    value.sections.map((section) => [section.id, section]),
  );
  const nextSections = (page.attributes.page_details?.data ?? []).map(
    (section) => {
      const edit = editsById.get(section.id);

      if (!edit) return section;

      return {
        ...section,
        attributes: {
          ...section.attributes,
          title: edit.title,
          description: edit.description,
          link: edit.link.trim() ? edit.link : null,
        },
      };
    },
  );

  return {
    ...file,
    timestamp: now.getTime(),
    data: {
      ...file.data,
      data: [
        {
          ...page,
          attributes: {
            ...page.attributes,
            page_details: {
              ...page.attributes.page_details,
              data: nextSections,
            },
          },
        },
      ],
    },
  };
};
