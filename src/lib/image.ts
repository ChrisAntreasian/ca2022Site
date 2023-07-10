import type { StrapiImageData } from "$lib/typing/art";
import { 
	function as FN, 
	option as O, 
	readonlyRecord as RR 
} from "fp-ts";

export const safeImageString = (size: "small" | "medium" | "thumbnail" | "original") => FN.flow(
	(pd: StrapiImageData) => pd.data.attributes,
	attr => FN.pipe(
		attr.formats, 
		RR.lookup(size), 
		O.fold(
			() => attr.url, 
			_ => _.url
		)
	)
);