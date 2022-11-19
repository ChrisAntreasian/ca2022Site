import { handleGetResponse, mkRequest, queryStr } from "$lib/api";
import * as qs from "qs";

const q = qs.stringify({
	filters: {
		id: { $in: 3 },
	},
  populate: [
		"omit",
		"featured",
    "art_pieces",
    "art_pieces.image",
		"art_pieces.image.media",
  ],
});

export const fetchData = async () => {
  const response = await mkRequest("GET", `art-categories?${q}`);
	return await handleGetResponse(response);
}