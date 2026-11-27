import { describe, expect, it, vi } from "vitest";
import * as fs from "fs";

import { DEFAULT_S3_PREFIX, fsDataStore } from "#lib/dataStore.server";
import {
  DEFAULT_PULL_PREFIX,
  pullLayoutPlan,
  pullSummary,
  pullWriteDecision,
} from "../../scripts/pull-content.mjs";

// A fake `fs` holding the tree a pull would write, so `fsDataStore` — the store the app uses when
// CONTENT_LIVE_SOURCE is unset — can be run over that tree unchanged. Nothing in this file mocks the
// store: the point is that the paths a pull writes are the paths a store reads.
vi.mock("fs", () => {
  const files = new Map<string, string>();
  const norm = (p: string) =>
    String(p).replace(/\\/gu, "/").replace(/^\.\//u, "");
  const missing = (code: string) => Object.assign(new Error(code), { code });

  return {
    default: {},
    constants: { F_OK: 0 },
    promises: {
      readFile: async (path: string) => {
        const value = files.get(norm(path));

        if (value === undefined) throw missing("ENOENT");

        return value;
      },
      readdir: async (dir: string) => {
        const base = norm(dir);
        const prefix = base.length === 0 ? "" : `${base}/`;
        const names = new Set<string>();

        for (const key of files.keys()) {
          if (!key.startsWith(prefix)) continue;

          const rest = key.slice(prefix.length);
          const slash = rest.indexOf("/");

          names.add(slash === -1 ? rest : rest.slice(0, slash));
        }

        if (names.size === 0) throw missing("ENOENT");

        return [...names];
      },
      writeFile: async (path: string, body: string) => {
        files.set(norm(path), String(body));
      },
      mkdir: async () => undefined,
      access: async (path: string) => {
        if (!files.has(norm(path))) throw missing("ENOENT");
      },
    },
  };
});

/**
 * Card T4 — the bucket-to-disk half of `scripts/pull-content.mjs`.
 *
 * T2 mirrors every bucket write into `src/data/`. That protects a laptop that is still working, and does
 * nothing for a disk that is gone: the only copy of the tree then lives in a bucket nobody can open. This
 * script is the reverse of the seed, and the decision it has to get right is where a bucket key lands on
 * disk — because the point of pulling is that the app's own local store can read what the pull wrote.
 *
 * `src/lib/dataStore.server.ts` keeps its records in `./src/data/draft/<name>.json`,
 * `./src/data/live/<name>.json`, tiered snapshots in `./src/data/history/<tier>/<name>/<ts>.json`, and the
 * pre-tier legacy snapshots in the **flat** `./src/data/history/<name>/<ts>.json`. A pull that mirrors the
 * bucket's directory names instead of those paths writes files the app cannot open.
 *
 * Tests cover the three pure decisions only: key → path, clobber or not, and layout refusal. `main` is the
 * part that lists, gets and writes.
 */

type BucketObject = { key: string; size: number; body?: string };

const obj = (key: string, body?: string): BucketObject => ({
  key,
  size: body === undefined ? 12 : body.length,
  ...(body === undefined ? {} : { body }),
});

const layout = (objects: BucketObject[], prefix = "data") =>
  pullLayoutPlan(objects, { prefix });

const oneLayout = (key: string, prefix = "data") =>
  layout([obj(key)], prefix)[0];

const goodRow = (key: string, prefix = "data", body?: string) => {
  const row = layout([obj(key, body)], prefix)[0];

  if (row.bad)
    throw new Error(`test setup: ${key} was refused (${row.reason})`);

  return row;
};

const decide = (
  key: string,
  local: { exists: boolean; size?: number },
  options: { overwrite?: boolean; body?: string } = {},
  prefix = "data",
) =>
  pullWriteDecision(goodRow(key, prefix, options.body), {
    local,
    overwrite: options.overwrite ?? false,
    body: options.body,
  });

describe("pullLayoutPlan", () => {
  describe("keys the stores already understand map onto the paths those stores read", () => {
    it("maps a draft record onto the draft record path", () => {
      const row = oneLayout("data/draft/poems.json");

      expect(row.localPath).toBe("src/data/draft/poems.json");
      expect(row.kind).toBe("record");
      expect(row.tier).toBe("draft");
      expect(row.name).toBe("poems");
      expect(row.bad).toBe(false);
    });

    it("maps a live record onto the live record path, not onto the bundled payload the app imports", () => {
      const row = oneLayout("data/live/poems.json");

      expect(row.localPath).toBe("src/data/live/poems.json");
      expect(row.tier).toBe("live");
      // src/data/poems.json is the bundled payload the app imports. Overwriting it would change what a
      // public page serves from the repo itself, so a pull never aims at a root-level file.
      expect(row.localPath).not.toBe("src/data/poems.json");
    });

    it("maps a tiered snapshot onto the tiered snapshot path it came from", () => {
      expect(oneLayout("data/history/draft/poems/111.json").localPath).toBe(
        "src/data/history/draft/poems/111.json",
      );
      expect(oneLayout("data/history/live/poems/222.json").localPath).toBe(
        "src/data/history/live/poems/222.json",
      );
    });

    it("maps a flat snapshot onto the flat legacy path the local store reads it from", () => {
      const row = oneLayout("data/history/poems/1712345678901.json");

      expect(row.localPath).toBe("src/data/history/poems/1712345678901.json");
      expect(row.kind).toBe("snapshot");
      expect(row.tier).toBe("legacy");
      expect(row.timestamp).toBe(1712345678901);
    });

    it("keeps a snapshot that is already under the legacy tier of the bucket in the flat legacy dir", () => {
      // src/data/history/legacy/poems/111.json is not a legacy tier to the local store, it is a content key
      // called "legacy" with a directory under it. The bucket's legacy tier and the local flat layout are
      // the same tier under two names, and the pull has to know that.
      const row = oneLayout("data/history/legacy/poems/111.json");

      expect(row.localPath).toBe("src/data/history/poems/111.json");
      expect(row.tier).toBe("legacy");
      expect(row.localPath).not.toContain("history/legacy/");
    });

    it("says out loud that the legacy tier was moved to the layout the local store reads", () => {
      expect(oneLayout("data/history/legacy/poems/111.json").reason).toContain(
        "flat",
      );
    });

    it("gives the two names of the same legacy snapshot the same local path", () => {
      // T3 uploads `src/data/history/poems/111.json` as `…/history/legacy/poems/111.json`. A pull that
      // mapped that key anywhere else would not put the tree back where it started.
      const fromFlatBucket = oneLayout("data/history/poems/111.json");
      const fromLegacyBucket = oneLayout("data/history/legacy/poems/111.json");

      expect(fromFlatBucket.localPath).toBe(fromLegacyBucket.localPath);
      expect(fromFlatBucket.timestamp).toBe(fromLegacyBucket.timestamp);
    });

    it("carries the byte size the listing reported", () => {
      const [row] = layout([obj("data/draft/poems.json", "{}")]);

      expect(row.bytes).toBe(2);
    });

    it("pulls from the root the app is configured with, and only that root", () => {
      const rows = layout([obj("dev-data/draft/poems.json")], "dev-data");

      expect(rows[0].localPath).toBe("src/data/draft/poems.json");
    });

    it("defaults to the same root the app defaults to", () => {
      expect(DEFAULT_PULL_PREFIX).toBe(DEFAULT_S3_PREFIX);
    });

    it("refuses a root the store could not use", () => {
      for (const bad of [
        "Dev Data",
        "dev_data",
        "data/",
        "data/nested",
        "",
        " ",
      ]) {
        expect(() => layout([obj("data/draft/poems.json")], bad)).toThrow(
          /prefix/,
        );
      }
    });
  });

  describe("a key nothing wrote there is refused, not renamed", () => {
    it("refuses a key that is not in the root it was told to pull from", () => {
      const row = oneLayout("other-data/draft/poems.json", "dev-data");

      expect(row.bad).toBe(true);
      expect(row.localPath).toBeNull();
      expect(row.reason).toContain("dev-data/");
    });

    it("refuses an object sitting in the root itself", () => {
      for (const key of [
        "data/poems.json",
        "data/notes.txt",
        "data/strapi-import/poems.json",
        "data/backup/draft/poems.json",
      ]) {
        const row = oneLayout(key);

        expect(row.bad).toBe(true);
        expect(row.reason).toContain("draft/, live/ or history/");
      }
    });

    it("refuses a record path that is not <name>.json directly in a tier", () => {
      for (const key of [
        "data/draft/poems/extra.json",
        "data/draft/poems.json.bak",
        "data/draft/.json",
        "data/live/layout/1712345678901.json",
        "data/draft/",
      ]) {
        expect(oneLayout(key).bad).toBe(true);
      }
    });

    it("refuses a name this repo does not serve", () => {
      for (const key of [
        "data/draft/blogroll.json",
        "data/live/About.json",
        "data/live/about.json",
        "data/history/draft/blogroll/111.json",
      ]) {
        const row = oneLayout(key);

        expect(row.bad).toBe(true);
        expect(row.reason).toMatch(
          /not one of the content keys|draft\/, live\/ or history\//,
        );
      }
    });

    it("refuses a history path that is not one of the two layouts the stores read", () => {
      for (const key of [
        "data/history/README.json",
        "data/history/poems/draft/111.json",
        "data/history/draft/poems/sub/111.json",
        "data/history/draft/poems/111.json/extra.json",
        "data/history/draft/111.json",
      ]) {
        const row = oneLayout(key);

        expect(row.bad).toBe(true);
        // Not just "bad": the reason has to name the layout, because the seven content keys include one
        // called "layout" and a reason built from the key list would otherwise look like a layout refusal.
        expect(row.reason).toMatch(
          /unrecognised history layout|is not a version of anything|is a tier name/,
        );
      }
    });

    it("refuses a snapshot whose timestamp is not a positive integer", () => {
      for (const ts of ["0", "00", "0111", "1.5", "-111", "1e10", "abc", ""]) {
        const row = oneLayout(`data/history/poems/${ts}.json`);

        expect(row.bad).toBe(true);
        expect(row.timestamp).toBeNull();
        expect(row.reason).toContain("timestamp");
      }
    });

    it("refuses a snapshot that is not a .json file", () => {
      for (const key of [
        "data/history/poems/notes.txt",
        "data/history/poems/111.json.bak",
        "data/history/draft/poems/111.json.bak",
      ]) {
        const row = oneLayout(key);

        expect(row.bad).toBe(true);
        expect(row.reason).toMatch(/\.json/);
      }
    });

    it("refuses a key that would write outside src/data", () => {
      for (const key of [
        "data/draft/../../outside.json",
        "data/history/poems/../../../outside.json",
        "data/history/../../../outside/111.json",
        "data/draft/../live/poems.json",
      ]) {
        const row = oneLayout(key);

        expect(row.bad).toBe(true);
        expect(row.localPath).toBeNull();
        expect(row.reason).toContain("outside");
      }
    });
  });
});

describe("pullWriteDecision", () => {
  const draft = "data/draft/poems.json";
  const live = "data/live/poems.json";
  const snapshot = "data/history/draft/poems/111.json";
  const legacy = "data/history/poems/111.json";

  it("writes what has no local copy", () => {
    for (const key of [draft, live, snapshot, legacy]) {
      const decision = decide(key, { exists: false }, { body: "{}" });

      expect(decision.action).toBe("write");
    }
  });

  it("refuses to clobber a local file when the user did not say --overwrite", () => {
    const decision = decide(draft, { exists: true, size: 10 }, { body: "{}" });

    expect(decision.action).toBe("skip-existing");
    expect(decision.reason).toContain("src/data/draft/poems.json");
    expect(decision.reason).toMatch(/--overwrite/);
  });

  it("writes over an existing file when --overwrite was named", () => {
    const decision = decide(
      draft,
      { exists: true, size: 10 },
      { body: "{}", overwrite: true },
    );

    expect(decision.action).toBe("write");
  });

  it("names a live overwrite as a content change git is tracking, and says nothing like that about a draft", () => {
    const liveOverwrite = decide(
      live,
      { exists: true, size: 10 },
      { body: "{}", overwrite: true },
    );
    const draftOverwrite = decide(
      draft,
      { exists: true, size: 10 },
      { body: "{}", overwrite: true },
    );

    expect(liveOverwrite.action).toBe("write");
    expect(liveOverwrite.warning).toContain("src/data/live/");
    expect(liveOverwrite.warning).toMatch(/git/);
    expect(draftOverwrite.warning).toBeUndefined();
  });

  it("says what a skipped local copy is doing relative to the bucket copy", () => {
    const sameSize = decide(draft, { exists: true, size: 2 }, { body: "{}" });
    const otherSize = decide(draft, { exists: true, size: 7 }, { body: "{}" });
    const unknown = decide(
      "data/draft/layout.json",
      { exists: true },
      {
        body: "{}",
      },
    );

    expect(sameSize.reason).toContain("same 2 bytes");
    expect(otherSize.reason).toContain("local 7 bytes");
    expect(otherSize.reason).toContain("bucket 2 bytes");
    expect(unknown.reason).toMatch(/not compared/);
  });

  it("names a skipped live copy as git-tracked content rather than an ignored working copy", () => {
    const decision = decide(live, { exists: true, size: 10 }, { body: "{}" });

    expect(decision.action).toBe("skip-existing");
    expect(decision.reason).toMatch(/git/);
  });

  it("refuses an object whose JSON does not parse, and says what it was aiming at", () => {
    const decision = decide(
      draft,
      { exists: false },
      { body: '{"name": "poems",' },
    );

    expect(decision.action).toBe("skip-bad");
    expect(decision.reason).toContain("does not parse");
  });

  it("refuses an empty object instead of writing an empty file", () => {
    const decision = decide(snapshot, { exists: false }, { body: "" });

    expect(decision.action).toBe("skip-bad");
    expect(decision.bytes).toBe(0);
  });

  it("writes an object whose JSON parses, including one whose body is a bare value", () => {
    const decision = decide(legacy, { exists: false }, { body: "[]" });

    expect(decision.action).toBe("write");
  });

  it("does not claim a parse decision for a body it was never given", () => {
    const decision = decide(draft, { exists: true, size: 10 });

    expect(decision.action).toBe("skip-existing");
    expect(decision.parseChecked).toBe(false);
  });

  it("carries a layout refusal through without dressing it up as a write", () => {
    const row = oneLayout("data/history/README.json");

    expect(row.bad).toBe(true);

    const decision = pullWriteDecision(row, { local: { exists: false } });

    expect(decision.action).toBe("skip-bad");
    expect(decision.reason).toBe(row.reason);
  });
});

describe("what the summary reports", () => {
  const badLayout = pullWriteDecision(oneLayout("data/history/README.json"), {
    local: { exists: false },
  });
  const rows = [
    decide("data/draft/poems.json", { exists: false }, { body: "{}" }),
    decide("data/live/poems.json", { exists: false }, { body: "{}" }),
    decide(
      "data/draft/layout.json",
      { exists: true, size: 10 },
      { body: "{}" },
    ),
    badLayout,
  ];

  it("counts written, skipped-existing and skipped-bad separately", () => {
    const summary = pullSummary(rows);

    expect(summary.written).toBe(2);
    expect(summary.skippedExisting).toBe(1);
    expect(summary.skippedBad).toBe(1);
  });

  it("totals only the bytes it would write", () => {
    const summary = pullSummary([
      decide("data/draft/poems.json", { exists: false }, { body: '{"a":1}' }),
      decide(
        "data/draft/layout.json",
        {
          exists: true,
          size: 10,
        },
        { body: '{"a":1}' },
      ),
    ]);

    expect(summary.writtenBytes).toBe(7);
  });

  it("says zero things about an empty plan", () => {
    expect(pullSummary([])).toEqual({
      written: 0,
      writtenBytes: 0,
      skippedExisting: 0,
      skippedBad: 0,
      liveWrites: 0,
    });
  });

  it("counts the live writes it warned about", () => {
    const rows = [
      decide("data/live/poems.json", { exists: false }, { body: "{}" }),
      decide("data/live/layout.json", { exists: false }, { body: "{}" }),
      decide("data/draft/poems.json", { exists: false }, { body: "{}" }),
    ];

    expect(pullSummary(rows).liveWrites).toBe(2);
  });
});

describe("what the app's own local store can read after a pull", () => {
  const bucketObjects = [
    obj("data/draft/poems.json", '{"name":"poems","timestamp":3,"data":[]}'),
    obj("data/live/poems.json", '{"name":"poems","timestamp":4,"data":[]}'),
    obj("data/history/draft/poems/111.json", '{"timestamp":111}'),
    obj("data/history/live/poems/222.json", '{"timestamp":222}'),
    obj(
      "data/history/legacy/poems/1712345678901.json",
      '{"timestamp":1712345678901}',
    ),
  ];

  const pullIntoFakeDisk = async () => {
    for (const row of layout(bucketObjects)) {
      if (row.bad)
        throw new Error(`test setup: ${row.key} refused (${row.reason})`);

      const index = bucketObjects.findIndex((o) => o.key === row.key);

      await fs.promises.writeFile(
        row.localPath,
        bucketObjects[index].body ?? "",
      );
    }
  };

  it("puts every pulled object where the local store reads it from", async () => {
    await pullIntoFakeDisk();

    expect(await fsDataStore.readFile("poems", "draft")).toBe(
      '{"name":"poems","timestamp":3,"data":[]}',
    );
    expect(await fsDataStore.readFile("poems", "live")).toBe(
      '{"name":"poems","timestamp":4,"data":[]}',
    );
  });

  it("pulls a history tree the local store can list, in the tiers it names", async () => {
    await pullIntoFakeDisk();

    expect(await fsDataStore.listHistory("poems")).toEqual([
      { timestamp: 1712345678901, scope: "legacy" },
      { timestamp: 222, scope: "live" },
      { timestamp: 111, scope: "draft" },
    ]);
  });

  it("reads back a legacy snapshot the bucket held under its legacy tier", async () => {
    await pullIntoFakeDisk();

    expect(
      await fsDataStore.readHistory("poems", 1712345678901, "legacy"),
    ).toBe('{"timestamp":1712345678901}');
  });

  it("would leave the local store blind to a legacy tier mapped 1:1 into history/legacy/", async () => {
    // The 1:1 reading of the card's mapping: write the bucket's `history/legacy/...` key into a directory
    // called `legacy`. The local store's legacy tier is the flat dir, so this file is not a version of
    // anything — it is a content key called "legacy" with a folder under it. Kept as a test so the next
    // reader of this file can see why the plan does not do it.
    await fs.promises.writeFile(
      "src/data/history/legacy/landing/999.json",
      '{"timestamp":999}',
    );

    expect(
      await fsDataStore.listHistory("landing", { scope: "legacy" }),
    ).toEqual([]);
    await expect(
      fsDataStore.readHistory("landing", 999, "legacy"),
    ).rejects.toThrow();
  });
});
