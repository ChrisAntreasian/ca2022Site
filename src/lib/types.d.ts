
type StrapiMeta = {
	meta: {
		pagination: {
			page: number;
			pageCount: number;
			pageSize: number;
			total: number;
		}
	}
};

type StrapiBase = {
	createdAt: string;
	updatedAt: string;
	publishedAt: string;
}

 type Poem = StrapiBase & {
	title: string;
	body: string;
	featured: boolean;
  position: number;
}

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

type Art = StrapiBase & {
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

type PageDetails = StrapiBase & {
	title: string;
	description: string;
	art_categories: StrapiDataArr<ArtCategory>;
	poems: StrapiDataArr<Poem>;
	link: string;
	art_piece: StrapiData<Art>;
	image: StrapiImageData;
}

export type StrapiArt = StrapiDataArr<Art>;

type RichLink = {
	title: string;
	body: string;
	image: StrapiImageData
	link: string;
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

type StrapiApiResp<A> = StrapiDataArr<A> & StrapiMeta;

export type StrapiPoem = StrapiApiResp<Poem>;
