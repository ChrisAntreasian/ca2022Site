import * as t from "io-ts";

const strapiMetaDataC = t.type({
	meta: t.type({
		pagination: t.type({
			page: t.number,
			pageCount: t.number,
			pageSize: t.number,
			total: t.number
		})
	})
});

type StrapiMetaDataC = typeof strapiMetaDataC;
type StrapiMeta = t.TypeOf<StrapiMetaDataC>;

const withIdC = <A extends t.Mixed>(d: A) => t.type({
	id: t.number,
	attributes: d
});

const strapiDataArrC = <A extends t.Mixed>(d: A) => t.type({
	data: t.array(withIdC(d))
});

const strapiBaseC = t.type({
	createdAt: t.string,
	updatedAt: t.string,
	publishedAt: t.string
});

type StrapiBaseC = typeof strapiBaseC;
type StrapiBase = t.TypeOf<StrapiBaseC>;

const poemC = t.intersection([
	strapiBaseC, 
	t.type({
		title: t.string,
		body: t.string,
		featured: t.boolean,
		position: t.number
	})
]);

export const strapiPoemC = t.intersection([strapiDataArrC(poemC), strapiMetaDataC]);
type StrapiPoemC = typeof strapiPoemC;

export type StrapiPoem = t.TypeOf<StrapiPoemC>;
 
type ImageBase =  {
	ext: string
	height: number;
	hash: string;
	mime: string;
	name: string;
	size: number;
	url: string;
	width: number;
}
type ImageAttrs = ImageBase & {
	alternativeText: string;
	caption: string;
	provider: string,
	provider_metadata: any,
	previewUrl: any
	formats: {
		"small": ImageBase,
		"medium"?: ImageBase;
		"thumbnail": ImageBase;
	}	
};

export type StrapiImageData = {
	data: WithId<ImageAttrs>
};

export type Art = StrapiBase & {
	title: string;
	description: string;
	createdDate: string;
	medium: string;
	order: number;
	image: StrapiImageData;
};

export type WithId<A> = {
	id: number;
	attributes: A
}
type StrapiDataArr<A> = {
	data: Array<WithId<A>>;
}
type StrapiData<A> = {
	data: WithId<A>;
}

export type PageDetails = StrapiBase & {
	title: string;
	description: string;
	art_categories: StrapiDataArr<ArtCategory>;
	poems: StrapiDataArr<StrapiPoem>;
	link: string;
	art_piece: StrapiData<Art>;
	image: StrapiImageData;
}

export type StrapiArt = StrapiDataArr<Art>;

type RichLink = {
	title: string;
	body: string;
	image: ReadonlyArray<StrapiImageData>;
	logo: StrapiImageData;
	link: string;
	secondLink: string;
	position: number;
}

type ArtCategory = StrapiBase & {
	title: string;
	art_pieces: StrapiArt;
	omit: StrapiDataArr<{ title: string, description: string }>,
};

export type StrapiPage = StrapiData<
	StrapiBase & {
		title: string,
		art_pieces: StrapiArt;
		page_details: StrapiDataArr<PageDetails>;
		rich_links: StrapiDataArr<RichLink>
	}
>;

export type StrapiPageDetails = StrapiDataArr<PageDetails>["data"];

export type StrapiApiResp<A> = StrapiDataArr<A> & StrapiMeta;

export type StrapiRichLink = StrapiApiResp<RichLink>;
