export interface Locals {
	userid: string;
}

type StrapiData<A> = {
	data: Array<{
			id: number;
			attributes: A
		}>;
	meta: {
		pagination: {
			page: number;
			pageCount: number;
			pageSize: number;
			total: number;
		}
	}
}

export type Id = number;

export type Poem = {
	title: string;
	body: string;
	meta: any;
	featured: boolean;
}
export type StrapiPoem = StrapiData<Poem>;

type Image = {
	ext: string
	height: number;
	mime: string;
	name: string;
	size: number;
	url: string;
	width: number;
}

export type Art = {
	title: string;
	description: string;
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
export type StrapiArt = StrapiData<Art>