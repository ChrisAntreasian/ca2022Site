import type { StrapiImageData } from "$lib/typing/art";
import { pipe, Option, Record } from "effect";

export const safeImageString = (
  size: "small" | "medium" | "thumbnail" | "original",
) =>
  (pd: StrapiImageData) => {
    const attr = pd.data.attributes;
    
    if (size === "original" || !attr.formats || typeof attr.formats !== "object") {
      return attr.url;
    }
    
    return pipe(
      attr.formats as Record<string, { url: string }>,
      Record.get(size),
      Option.match({
        onNone: () => attr.url,
        onSome: (img) => img.url,
      }),
    );
  };
