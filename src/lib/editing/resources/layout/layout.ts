import { Schema } from "effect";

import type { EditorDefinition } from "../../core/definitions";

/**
 * The editable surface for the site chrome. Only the fields `+layout.server.ts` actually consumes are
 * exposed: the header title (which also drives the shortened mobile title) and the logo image URL. The
 * logo is stored as a plain URL string rather than the full Strapi media record so the editor stays a
 * simple text field; the loader already passes only that URL to `Header.svelte`.
 */
export const layoutEditorValueC = Schema.Struct({
  title: Schema.String,
  logoUrl: Schema.String,
});

export type LayoutEditorValue = Schema.Schema.Type<typeof layoutEditorValueC>;

/** Mirrors `layout.json`: the store envelope wrapping a single-entry Strapi payload. */
export const layoutFileC = Schema.Struct({
  name: Schema.String,
  timestamp: Schema.Number,
  data: Schema.Struct({
    data: Schema.Array(
      Schema.Struct({
        id: Schema.optional(Schema.Number),
        attributes: Schema.Struct({
          title: Schema.String,
          description: Schema.optional(Schema.NullOr(Schema.String)),
          link: Schema.optional(Schema.NullOr(Schema.String)),
          image: Schema.Struct({
            data: Schema.Struct({
              attributes: Schema.Struct({ url: Schema.String }),
            }),
          }),
        }),
      }),
    ),
  }),
});

export type LayoutFile = Schema.Schema.Type<typeof layoutFileC>;

export const layoutEditorDefinition = {
  key: "layout",
  label: "Site Layout",
  schema: layoutEditorValueC,
  fields: [
    {
      name: "title",
      label: "Header title",
      kind: "text",
      placeholder: "Name shown in the header",
      required: true,
    },
    {
      name: "logoUrl",
      label: "Logo image URL",
      kind: "text",
      placeholder: "https://.../logo.png",
      required: true,
    },
  ],
  createDefault: () => ({
    title: "",
    logoUrl: "",
  }),
} satisfies EditorDefinition<LayoutEditorValue>;

export const toLayoutEditorValue = (file: LayoutFile): LayoutEditorValue => {
  const entry = file.data.data?.[0];

  if (!entry) return layoutEditorDefinition.createDefault();

  return {
    title: entry.attributes.title,
    logoUrl: entry.attributes.image?.data?.attributes?.url ?? "",
  };
};

/**
 * Preserve everything the loader and downstream pages rely on (timestamps, the media record's identity)
 * while replacing only the two editable fields. `image` keeps its nested shape so existing consumers of
 * the raw file continue to work unchanged.
 */
export const upsertLayoutEditorValue = (
  file: LayoutFile,
  value: LayoutEditorValue,
  now = new Date(),
): LayoutFile => {
  const entry = file.data.data?.[0];

  if (!entry) return file;

  const nextEntry = {
    ...entry,
    attributes: {
      ...entry.attributes,
      title: value.title,
      image: {
        data: {
          attributes: {
            url: value.logoUrl,
          },
        },
      },
    },
  };

  return {
    ...file,
    timestamp: now.getTime(),
    data: {
      ...file.data,
      data: [nextEntry],
    },
  };
};
