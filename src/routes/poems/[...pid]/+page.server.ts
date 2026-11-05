import type { Item } from "#lib/Article/types";
import { isEditorEnabled } from "#lib/editing/core/auth.server";
import { readPublicPoemsFile } from "#lib/editing/resources/poems/poems.server";

import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
  // Phase 3: the payload comes from the content store at the tier `publicReadScope` selects, not from a
  // static `#data` import. With live content still on disk this resolves to the same file the old import
  // read; once poems are released into S3 it becomes the released copy with a bundled fallback.
  const { data: file } = await readPublicPoemsFile();
  const pid =
    parseInt(params.pid) ||
    file.data[Math.floor(Math.random() * file.data.length)].id;

  const items = [...file.data]
    // Copy before sorting: the store hands back its own decoded array, and sorting it in place would
    // reorder the payload for every later read. The old static import had the same hazard.
    .sort((a, b) => a.attributes.position - b.attributes.position)
    .reduce(
      (acc: ReadonlyArray<Item>, i) => [
        ...acc,
        {
          id: i.id,
          title: i.attributes.title,
          body: i.attributes.body,
        },
      ],
      [],
    );

  const item = items.filter((i: Item) => i.id === pid)[0];

  return { items, item, editorEnabled: isEditorEnabled() };
};
