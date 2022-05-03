
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
	meta: any;
	featured: boolean;
}

type Image = StrapiBase & {
	ext: string
	height: number;
	mime: string;
	name: string;
	size: number;
	url: string;
	width: number;
}

type Art = StrapiBase & {
	title: string;
	description: string;
	createdDate: string;
	medium: string;
	order: number;
	image: {
		data: {
			attributes: Image & {
				alternativeText: string;
				caption: string;
				formats: {
					"small": Image,
					"medium": Image;
					"thumbnail": Image;
				}	
			}
		}
	};
}

type StrapiData<A> = {
	data: Array<{
			id: number;
			attributes: A
		}>;
}

type PageDetails = StrapiBase & {
	title: string;
	description: string;
	art_categories: StrapiData<ArtCategory>
	poems: StrapiData<Poem>
}

export type StrapiArt = StrapiData<Art>;

type RichLink = {
	title: string;
	body: string;
	image: StrapiArt;
	link: string;
}

type ArtCategory = StrapiBase & {
	title: string;
	art_pieces: StrapiArt;
	omit: StrapiData<{ title: string, description: string }>,
};

type Page = StrapiBase & {
	title: string,
	art_pieces: StrapiArt;
	page_details: StrapiData<PageDetails>;
	rich_links: StrapiData<RichLink>;
}
export type StrapiPageDetails = StrapiData<PageDetails>["data"];

type StrapiApiResp<A> = StrapiData<A> & StrapiMeta;

export type StrapiPage = StrapiApiResp<Page>
export type StrapiPoem = StrapiApiResp<Poem>;
export type StrapiArtCategory = StrapiApiResp<ArtCategory>;