import type { StrapiImageData } from "$lib/typing/art";
import { FN, O, RR } from "$lib/fp-ts";

export const safeImageString = (size: "small" | "medium" | "thumbnail" | "original") => FN.flow(
	(pd: StrapiImageData) => pd.data.attributes,
	attr => FN.pipe(
		attr.formats, 
		RR.lookup(size), 
		O.fold(() => attr.previewUrl, _ => _.url)
	)
);