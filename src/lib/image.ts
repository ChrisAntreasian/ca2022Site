import type { StrapiImageData } from "./types";
import { pipe, flow } from "fp-ts/lib/function";

import * as O from "fp-ts/lib/Option";
import * as R from "fp-ts/lib/Record";

export const safeImageString = (size: "small" | "medium" | "thumbnail" | "original") => flow(
	(pd: StrapiImageData) => pd.data.attributes,
	attr => pipe(
		attr.formats, 
		R.lookup(size), 
		O.fold(() => attr.url, _ => _.url)
	)
);