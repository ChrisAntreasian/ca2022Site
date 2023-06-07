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
	data: t.union([withIdC(d), t.null])
});

export const strapiDataArrC = <A extends t.Mixed>(d: A) => t.type({
	data: t.union([t.array(withIdC(d)), t.null])
});

export const strapiUpdatedC = t.type({
	createdAt: t.string,
	updatedAt: t.string,
});

export const strapiBaseC = t.intersection([
	strapiUpdatedC,
	t.type({
		publishedAt: t.string,
	})
]);