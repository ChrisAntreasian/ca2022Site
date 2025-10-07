import { Schema } from "effect";
import { strapiBaseC, withIdC } from "./strapi";

export const poemC = Schema.extend(
  strapiBaseC,
  Schema.Struct({
    title: Schema.String,
    body: Schema.String,
    featured: Schema.Boolean,
    position: Schema.Number,
  }),
);

export const strapiPoemC = Schema.Struct({
  data: Schema.Union(
    Schema.Array(withIdC(poemC)),
    Schema.NullOr(Schema.Array(withIdC(poemC)))
  ),
  meta: Schema.Struct({
    pagination: Schema.Struct({
      page: Schema.Number,
      pageCount: Schema.Number,
      pageSize: Schema.Number,
      total: Schema.Number,
    }),
  }),
});

export type StrapiPoem = Schema.Schema.Type<typeof strapiPoemC>;
