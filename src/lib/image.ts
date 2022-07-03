import { identity } from "svelte/internal";
import type { PageDetails, WithId, ImageData } from "./types";

export const safeImageString = (size: "small" | "medium" | "thumbnail" | "original") => (pd: ImageData) => 
  pd.data.attributes.formats && size !== "original"
		? pd.data.attributes.formats[size].url
		: pd.data.attributes.url;