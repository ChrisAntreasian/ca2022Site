export interface Locals {
	userid: string;
}
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

type StrapiData<A> = {
	data: Array<{
			id: number;
			attributes: A
		}>;
}

type StrapiApiResp<A> = StrapiData<A> & StrapiMeta;

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

export type StrapiArt = StrapiData<Art>;

type ArtCategory = StrapiBase & {
	title: string;
	art_pieces: StrapiArt;
	omit: StrapiData<{ title: string, description: string }>,
};
export type StrapiPoem = StrapiApiResp<Poem>;
export type StrapiArtCategory = StrapiApiResp<ArtCategory>;