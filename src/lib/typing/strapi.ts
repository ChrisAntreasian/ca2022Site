import { Schema } from "effect";

export const strapiMetaDataC = Schema.Struct({
  meta: Schema.Struct({
    pagination: Schema.Struct({
      page: Schema.Number,
      pageCount: Schema.Number,
      pageSize: Schema.Number,
      total: Schema.Number,
    }),
  }),
});

export const withIdC = <A, I, R>(d: Schema.Schema<A, I, R>) =>
  Schema.Struct({
    id: Schema.Number,
    attributes: d,
  });

export const strapiDataC = <A, I, R>(d: Schema.Schema<A, I, R>) =>
  Schema.Struct({
    data: Schema.Union(withIdC(d), Schema.NullOr(withIdC(d))),
  });

export const strapiDataArrC = <A, I, R>(d: Schema.Schema<A, I, R>) =>
  Schema.Struct({
    data: Schema.Union(Schema.Array(withIdC(d)), Schema.NullOr(Schema.Array(withIdC(d)))),
  });

export const strapiUpdatedC = Schema.Struct({
  createdAt: Schema.String,
  updatedAt: Schema.String,
});

export const strapiBaseC = Schema.extend(
  strapiUpdatedC,
  Schema.Struct({
    publishedAt: Schema.String,
  }),
);
