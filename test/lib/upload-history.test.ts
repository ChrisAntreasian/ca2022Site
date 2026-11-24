import { describe, expect, it } from "vitest";
import { vi } from "vitest";

import { MissingSnapshotError, createS3DataStore } from "#lib/dataStore.server";
import { DEFAULT_S3_PREFIX } from "#lib/dataStore.server";
import {
  CONTENT_KEY_NAMES,
  DEFAULT_BACKFILL_PREFIX,
  historyObjectExists,
  historyUploadPlan,
} from "../../scripts/upload-history.mjs";

/**
 * Card T3 — the plan behind `scripts/upload-history.mjs`.
 *
 * `src/data/history/` holds 72 snapshots in two layouts at once: 61 in the legacy flat layout
 * (`<name>/<ts>.json`, written before this repo had tiers) and 11 in the tiered layout
 * (`<tier>/<name>/<ts>.json`, written by the current store). The bucket holds 7, all in one tier. So the
 * backfill has to read a tier out of each path, and a wrong decision is not a wrong row in a list — it is
 * a snapshot filed under a tier the restore screen then cannot find, or a legacy version silently
 * collapsed onto a draft copy the editor made years later.
 *
 * Everything below is asserted against the plan function alone: no filesystem walk, no AWS client, no
 * `--apply`. The misfeature this card targets is the tier decision.
 */

type Snapshot = { path: string; size: number; body: string };

const LEGACY_BODY = '{"name":"poems","timestamp":1712345678901,"data":{}}';

/** A snapshot the way `main` hands it to the plan: a path, a byte size and the body it reads. */
const snapshot = (path: string, body = LEGACY_BODY): Snapshot => ({
  path,
  size: body.length,
  body,
});

const plan = (files: Snapshot[], options?: { prefix?: string }) =>
  historyUploadPlan(files, options);

const oneRow = (path: string, body?: string) => plan([snapshot(path, body)])[0];

const planned = (files: Snapshot[], options?: { prefix?: string }) =>
  plan(files, options).filter((row) => !row.skipped);

const keys = (files: Snapshot[], options?: { prefix?: string }) =>
  planned(files, options).map((row) => row.key);

const skipped = (files: Snapshot[]) => plan(files).filter((row) => row.skipped);

/**
 * A v3-shaped client double in the shape `test/lib/dataStore.s3.test.ts` uses: one `send(command)` entry
 * point dispatching on the command's own class name. Only what `dataStore.server.ts` imports is stubbed,
 * and the commands themselves are the real aws-sdk classes.
 */
const s3Objects = new Map<string, string>();

vi.mock("#lib/s3", () => ({
  initS3: vi.fn(),
  getS3Client: () => ({
    send: async (command: {
      constructor: { name: string };
      input: { Key?: string; Body?: unknown; Prefix?: string };
    }) => {
      const name = command.constructor.name;
      const key = command.input.Key ?? "";

      if (name === "PutObjectCommand") {
        s3Objects.set(key, String(command.input.Body));
        return {};
      }

      if (name === "GetObjectCommand") {
        const body = s3Objects.get(key);

        if (body === undefined) {
          // aws-sdk v3 shape, carried on both channels the store classifies on (`name` and `code`), the way
          // `test/lib/dataStore.s3.test.ts` hands it. A double that only carries `name` silently stops
          // classifying a real miss as a miss once a store reaches the client instead of refusing earlier.
          throw Object.assign(new Error("NoSuchKey"), {
            name: "NoSuchKey",
            code: "NoSuchKey",
            $metadata: { httpStatusCode: 404 },
          });
        }

        return { Body: body };
      }

      if (name === "ListObjectsV2Command") {
        const prefix = command.input.Prefix ?? "";

        return {
          IsTruncated: false,
          Contents: [...s3Objects.keys()]
            .filter((candidate) => candidate.startsWith(prefix))
            .map((Key) => ({ Key })),
        };
      }

      throw new Error(`unexpected S3 command ${name}`);
    },
  }),
  getOptionalS3Bucket: () => "ca2022s3",
  s3BodyToString: async (body: unknown) => String(body),
}));

describe("historyUploadPlan", () => {
  describe("the two layouts that exist on disk today", () => {
    it("maps a legacy flat snapshot onto the legacy tier", () => {
      const row = oneRow("src/data/history/poems/1712345678901.json");

      expect(row.key).toBe("data/history/legacy/poems/1712345678901.json");
      expect(row.localPath).toBe("src/data/history/poems/1712345678901.json");
      expect(row.tier).toBe("legacy");
      expect(row.name).toBe("poems");
      expect(row.timestamp).toBe(1712345678901);
      expect(row.skipped).toBe(false);
    });

    it("maps a tiered snapshot onto the tier its own path names", () => {
      const rows = plan([
        snapshot("src/data/history/draft/poems/111.json"),
        snapshot("src/data/history/live/poems/222.json"),
      ]);

      expect(rows.map((row) => row.key)).toEqual([
        "data/history/draft/poems/111.json",
        "data/history/live/poems/222.json",
      ]);
      expect(rows.map((row) => row.tier)).toEqual(["draft", "live"]);
    });

    it("leaves a snapshot that is already in the legacy tier where it is", () => {
      const row = oneRow("src/data/history/legacy/poems/5.json", LEGACY_BODY);

      expect(row.key).toBe("data/history/legacy/poems/5.json");
      expect(row.tier).toBe("legacy");
    });

    it("plans the flat copies and the tiered copies as two sets of keys, not one merged set", () => {
      const rows = plan([
        snapshot("src/data/history/poems/1000.json"),
        snapshot("src/data/history/web-experience/1001.json"),
        snapshot("src/data/history/draft/poems/111.json"),
        snapshot("src/data/history/live/poems/222.json"),
      ]);

      expect(rows.filter((row) => row.tier === "legacy")).toHaveLength(2);
      expect(rows.filter((row) => row.tier === "draft")).toHaveLength(1);
      expect(rows.filter((row) => row.tier === "live")).toHaveLength(1);
      // Two layouts, no collisions: every snapshot keeps a key of its own.
      expect(new Set(rows.map((row) => row.key))).toHaveLength(rows.length);
    });

    it("says, per row, which part of the path decided the tier", () => {
      expect(oneRow("src/data/history/poems/1000.json").reason).toMatch(
        /no tier segment/,
      );
      expect(
        oneRow("src/data/history/draft/poems/111.json", "{}").reason,
      ).toMatch(/tier segment "draft"/);
    });

    it("accepts a Windows path as readily as a forward-slash path", () => {
      // `main` walks with path.relative, which spells separators this way on Windows.
      expect(oneRow("src/data/history\\poems\\1712345678901.json").key).toBe(
        oneRow("src/data/history/poems/1712345678901.json").key,
      );
    });

    it("accepts the absolute paths a directory walk actually reports", () => {
      const absolute = `${process.cwd()}/src/data/history/poems/1712345678901.json`;

      expect(oneRow(absolute).key).toBe(
        "data/history/legacy/poems/1712345678901.json",
      );
    });
  });

  describe("a tier is one of three words, and nothing that merely resembles one", () => {
    it("does not read a content key that starts like a tier as a tier", () => {
      const row = oneRow("src/data/history/draft-of-war/111.json");

      expect(row.skipped).toBe(true);
      expect(row.key).toBeNull();
      expect(row.reason).toMatch(/draft-of-war/);
      expect(row.reason).toMatch(/not one of the content keys/);
    });

    it("does not read a name in the first slot of a three-segment path as a tier", () => {
      // "poems/draft/111.json" is not draft/poems/111.json. Uploading it as a draft version would move a
      // snapshot into a tier it never belonged to.
      const row = oneRow("src/data/history/poems/draft/111.json");

      expect(row.skipped).toBe(true);
      expect(row.key).toBeNull();
      expect(row.reason).toMatch(/unrecognised/);
    });

    it("does not invent a tier for a snapshot sitting directly in src/data/history", () => {
      const row = oneRow("src/data/history/README.json");

      expect(row.skipped).toBe(true);
      expect(row.reason).toContain("sits directly in src");
    });

    it("does not accept a deeper path as a snapshot", () => {
      const row = oneRow("src/data/history/draft/poems/sub/111.json");

      expect(row.skipped).toBe(true);
      expect(row.reason).toMatch(/unrecognised/);
    });

    it("reports a path that is not under src/data/history at all", () => {
      const row = oneRow("src/data/poems.json");

      expect(row.skipped).toBe(true);
      expect(row.reason).toContain("src/data/history/");
    });
  });

  describe("what gets reported instead of uploaded", () => {
    it.each([
      "0",
      "00",
      "0111",
      "1.5",
      "-111",
      "1e10",
      "1_000",
      "not-a-number",
      "1712345678901copy",
      "",
    ])("reports a snapshot whose timestamp is %s", (ts) => {
      const row = oneRow(`src/data/history/poems/${ts}.json`);

      expect(row.skipped).toBe(true);
      expect(row.key).toBeNull();
      expect(row.timestamp).toBeNull();
      expect(row.reason).toMatch(/timestamp/);
    });

    it("reports a snapshot whose JSON does not parse, and says why", () => {
      const row = oneRow(
        "src/data/history/poems/111.json",
        '{"name": "poems",',
      );

      expect(row.skipped).toBe(true);
      expect(row.reason).toMatch(/does not parse/);
    });

    it("reports an empty file instead of uploading nothing", () => {
      const row = oneRow("src/data/history/poems/111.json", "");

      expect(row.skipped).toBe(true);
      expect(row.size).toBe(0);
      expect(row.reason).toMatch(/does not parse/);
    });

    it("reports a name that is not one of the content keys this repo serves", () => {
      const rows = skipped([
        snapshot("src/data/history/blogroll/111.json"),
        snapshot("src/data/history/About/111.json"),
      ]);

      expect(rows).toHaveLength(2);
      expect(rows[0].reason).toMatch(/blogroll/);
      expect(rows[1].reason).toMatch(/About/);
      // Reported, never silently uploaded: no public read and no editor route names these.
      expect(rows.every((row) => row.key === null)).toBe(true);
    });

    it("reports about as a name this backfill does not upload", () => {
      // src/data/about.json is real, and `about` is not a ContentKey in src/lib/content.server.ts. The
      // legacy history dir holds an about snapshot, and it is the one file the card's "seven keys" rule is
      // really about.
      const row = oneRow("src/data/history/about/1668876785081.json");

      expect(row.skipped).toBe(true);
      expect(row.reason).toMatch(/about/);
      expect(CONTENT_KEY_NAMES).not.toContain("about");
    });

    it("reports a file that is not a .json snapshot", () => {
      const rows = skipped([
        snapshot("src/data/history/poems/notes.txt"),
        snapshot("src/data/history/poems/111.json.bak"),
      ]);

      expect(rows).toHaveLength(2);
      expect(rows.every((row) => /\.json/.test(row.reason))).toBe(true);
    });

    it("reports every problem and still plans the files that are fine", () => {
      const files = [
        snapshot("src/data/history/poems/111.json"),
        snapshot("src/data/history/poems/1.5.json"),
        snapshot("src/data/history/blogroll/222.json"),
        snapshot("src/data/history/draft/layout/333.json"),
      ];

      expect(keys(files)).toEqual([
        "data/history/legacy/poems/111.json",
        "data/history/draft/layout/333.json",
      ]);
      expect(plan(files).filter((row) => row.skipped)).toHaveLength(2);
    });
  });

  describe("the tiered copies of poems do not shadow the legacy copies", () => {
    const files = [
      snapshot("src/data/history/draft/poems/111.json", "{}"),
      snapshot("src/data/history/draft/poems/222.json", "{}"),
      snapshot("src/data/history/poems/111.json", LEGACY_BODY),
      snapshot("src/data/history/poems/1712345678901.json", LEGACY_BODY),
    ];

    it("plans both layouts for the same content key", () => {
      expect(keys(files)).toEqual([
        "data/history/draft/poems/111.json",
        "data/history/draft/poems/222.json",
        "data/history/legacy/poems/111.json",
        "data/history/legacy/poems/1712345678901.json",
      ]);
    });

    it("keeps a legacy snapshot that shares a timestamp with a tiered one", () => {
      // Same number, two layouts, two keys. Collapsing them is how a legacy copy disappears behind a draft
      // copy the editor made later.
      const produced = keys(files);

      expect(produced.filter((key) => key.endsWith("/111.json"))).toHaveLength(
        2,
      );
      expect(new Set(produced)).toHaveLength(produced.length);
    });

    it("counts the layouts separately", () => {
      const rows = plan(files);

      expect(rows.filter((row) => row.tier === "draft")).toHaveLength(2);
      expect(rows.filter((row) => row.tier === "legacy")).toHaveLength(2);
    });
  });

  describe("the body inside the file", () => {
    it("warns, rather than silently uploading, when the body names a different timestamp", () => {
      const row = plan([
        snapshot(
          "src/data/history/poems/111.json",
          '{"name":"poems","timestamp":999}',
        ),
      ])[0];

      expect(row.skipped).toBe(false);
      expect(row.key).toBe("data/history/legacy/poems/111.json");
      expect(row.warning).toMatch(/timestamp in its path/);
    });

    it("warns when the body names a different content key than the directory it is filed under", () => {
      const row = oneRow(
        "src/data/history/poems/111.json",
        '{"name":"web-experience","timestamp":111}',
      );

      expect(row.skipped).toBe(false);
      expect(row.warning).toMatch(/web-experience/);
    });

    it("says nothing about a body that agrees with the path it is filed under", () => {
      const row = oneRow(
        "src/data/history/poems/111.json",
        '{"name":"poems","timestamp":111}',
      );

      expect(row.warning).toBeUndefined();
    });
  });

  describe("what this repo's S3 store can read back today", () => {
    const feedThroughStore = (files: Snapshot[]) => {
      s3Objects.clear();

      // The plan and the files it was given stay in the same order, so a row's body is files[i].body.
      for (const [index, row] of plan(files).entries()) {
        if (!row.skipped) s3Objects.set(row.key, files[index].body);
      }

      return createS3DataStore({ prefix: DEFAULT_S3_PREFIX });
    };

    it("produces keys the store lists under the tier the path named, for the tiers it knows", async () => {
      const store = feedThroughStore([
        snapshot("src/data/history/draft/poems/111.json", "{}"),
        snapshot("src/data/history/live/poems/222.json", "{}"),
        snapshot("src/data/history/legacy/poems/333.json", "{}"),
      ]);

      expect(await store.listHistory("poems", { scope: "draft" })).toEqual([
        { timestamp: 111, scope: "draft" },
      ]);
      expect(await store.listHistory("poems", { scope: "live" })).toEqual([
        { timestamp: 222, scope: "live" },
      ]);
    });

    it("reads a planned key back with the tier named explicitly", async () => {
      const body = '{"name":"poems","timestamp":111,"data":[]}';
      const store = feedThroughStore([
        snapshot("src/data/history/draft/poems/111.json", body),
      ]);

      expect(await store.readHistory("poems", 111, "draft")).toBe(body);
    });

    it("lists and reads back a backfilled legacy snapshot, which is the hole the card left open", async () => {
      const store = feedThroughStore([
        snapshot("src/data/history/poems/1712345678901.json", LEGACY_BODY),
      ]);

      // Update the T5 legacy tier landed: `createS3DataStore` now lists a `history/legacy/<name>/<ts>.json`
      // key as a legacy entry and reads it back under that scope, so the 61 objects this script uploads are
      // no longer invisible to a version screen. This test used to pin the gap - it pinned it correctly, and
      // the store is what changed.
      const legacy = await store.listHistory("poems", {
        scope: "legacy",
      });

      expect(legacy).toEqual([{ timestamp: 1712345678901, scope: "legacy" }]);
      // A merged list carries the scope through, which is what lets a restore ask for a legacy version by
      // name instead of guessing a tier it was never filed under.
      expect(await store.listHistory("poems")).toEqual(legacy);
      expect(await store.readHistory("poems", 1712345678901, "legacy")).toBe(
        LEGACY_BODY,
      );

      // The tier being readable does not make a version that is not there come back: an upload that never
      // ran, or a timestamp mis-typed on a restore screen, must still fail rather than read as "nothing".
      await expect(
        store.readHistory("poems", 999999999999, "legacy"),
      ).rejects.toBeInstanceOf(MissingSnapshotError);
    });
  });

  describe("which root the keys are written into", () => {
    const files = [
      snapshot("src/data/history/poems/111.json"),
      snapshot("src/data/history/draft/layout/222.json", "{}"),
    ];

    it("defaults to the same root the app defaults to, so a backfill cannot disagree with a read", () => {
      expect(DEFAULT_BACKFILL_PREFIX).toBe(DEFAULT_S3_PREFIX);
      expect(keys(files)).toEqual([
        "data/history/legacy/poems/111.json",
        "data/history/draft/layout/222.json",
      ]);
    });

    it("roots every key in the prefix the app is configured with, when it is configured with one", () => {
      expect(keys(files, { prefix: "dev-data" })).toEqual([
        "dev-data/history/legacy/poems/111.json",
        "dev-data/history/draft/layout/222.json",
      ]);
    });

    it("refuses a prefix the store itself could not use", () => {
      for (const bad of [
        "Dev Data",
        "dev_data",
        "data/",
        "data/nested",
        "",
        " ",
      ]) {
        expect(() => plan(files, { prefix: bad })).toThrow(/prefix/);
      }
    });
  });

  describe("the plan is a plan", () => {
    it("plans from the records it is given, not from what is on disk", () => {
      const row = oneRow("src/data/history/web-experience/9999999999999.json");

      // Nothing on disk by that name, and nothing about it is wrong: main is the part that reads files.
      expect(row.skipped).toBe(false);
      expect(row.key).toBe(
        "data/history/legacy/web-experience/9999999999999.json",
      );
    });

    it("answers the same input the same way twice, so a retry cannot drift", () => {
      const files = [
        snapshot("src/data/history/poems/111.json"),
        snapshot("src/data/history/blogroll/222.json"),
      ];

      expect(plan(files)).toEqual(plan(files));
      expect(plan(files, { prefix: "dev-data" })).toEqual(
        plan(files, { prefix: "dev-data" }),
      );
    });

    it("exports the seven content keys the app says a public page reads", () => {
      expect(CONTENT_KEY_NAMES).toEqual([
        "landing",
        "layout",
        "poems",
        "terms-of-service",
        "the-quintuplapus",
        "the-souljuicer",
        "web-experience",
      ]);
    });
  });
});

describe("how the script answers whether an object is already in the bucket", () => {
  const sent: string[] = [];

  const clientHolding = (keys: string[]) => ({
    send: async (command: {
      constructor: { name: string };
      input: { Key?: string };
    }) => {
      sent.push(command.constructor.name);

      if (command.constructor.name !== "GetObjectCommand") {
        throw new Error(
          `the backfill must not send ${command.constructor.name}`,
        );
      }

      const key = command.input.Key ?? "";

      return keys.includes(key)
        ? { Body: "{}" }
        : (() => {
            throw Object.assign(new Error("missing"), { name: "NotFound" });
          })();
    },
  });

  const key = "data/history/legacy/poems/111.json";

  it("treats a successful GET as an object that is already there", async () => {
    expect(
      await historyObjectExists(clientHolding([key]), "ca2022s3", key),
    ).toBe(true);
  });

  it("treats a 404 as an object that is not there, instead of throwing", async () => {
    expect(
      await historyObjectExists(
        clientHolding([]),
        "ca2022s3",
        "data/history/legacy/poems/999.json",
      ),
    ).toBe(false);
  });

  it("recognises every way the bucket says it has no such key", async () => {
    const missingShapes = [
      { name: "NotFound" },
      { name: "NoSuchKey" },
      { name: "NoSuchKeyException" },
      { name: "NotFound", $metadata: { httpStatusCode: 404 } },
      { name: "SomeOtherCode", $metadata: { httpStatusCode: 404 } },
    ];

    for (const shape of missingShapes) {
      const s3 = {
        send: async () => {
          throw Object.assign(new Error("missing"), shape);
        },
      };

      expect(await historyObjectExists(s3, "ca2022s3", key)).toBe(false);
    }
  });

  it("probes with GetObjectCommand only, because that is how this repo probes history", async () => {
    sent.length = 0;

    await historyObjectExists(clientHolding([key]), "ca2022s3", key);

    expect(sent).toEqual(["GetObjectCommand"]);
  });

  it("rethrows an outage instead of calling it an absent object, so a real failure is not logged as a skip", async () => {
    const s3 = {
      send: async () => {
        throw Object.assign(new Error("SlowDown"), {
          name: "SlowDown",
          $metadata: { httpStatusCode: 503 },
        });
      },
    };

    await expect(historyObjectExists(s3, "ca2022s3", key)).rejects.toThrow(
      /SlowDown/,
    );
  });
});
