import * as t from "io-ts";

export const strapiMetaDataC = t.type({
	meta: t.type({
		pagination: t.type({
			page: t.number,
			pageCount: t.number,
			pageSize: t.number,
			total: t.number
		})
	})
});

export const withIdC = <A extends t.Mixed>(d: A) => t.type({
	id: t.number,
	attributes: d
});

export const strapiDataC = <A extends t.Mixed>(d: A) => t.type({
	data: withIdC(d)
});

export const strapiDataArrC = <A extends t.Mixed>(d: A) => t.type({
	data: t.array(withIdC(d))
});

export const strapiBaseC = t.type({
	createdAt: t.string,
	updatedAt: t.string,
	publishedAt: t.string
});

type StrapiBaseC = typeof strapiBaseC;
export type StrapiBase = t.TypeOf<StrapiBaseC>;

export const strapiApiRespC = <A extends t.Mixed>(d: A) => t.intersection([strapiDataArrC(d), strapiDataC(d)]);
