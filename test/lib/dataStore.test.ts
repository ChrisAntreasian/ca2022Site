import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

import { isHttpError } from "@sveltejs/kit";

import { fsDataStore, isMissingSnapshot } from "../../src/lib/dataStore.server";

// Mock fs module
vi.mock("fs", () => ({
  promises: {
    writeFile: vi.fn(),
    readFile: vi.fn(),
    mkdir: vi.fn(),
    access: vi.fn(),
    // The history reads list a directory, so this double has to be able to hand back a listing. A
    // store's list of saved versions is only as good as the listing it gets back.
    readdir: vi.fn(),
  },
  constants: {
    F_OK: 0,
  },
}));

import * as fs from "fs";

const writeCalls = () => vi.mocked(fs.promises.writeFile).mock.calls;

describe("fsDataStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.promises.readFile).mockRejectedValue(
      new Error("missing file"),
    );
    vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.promises.access).mockRejectedValue(
      new Error("missing snapshot"),
    );
    vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);
    // A key that has never been written has no history directories at all, which is the ordinary state
    // a fresh clone lands in. Tests that want a listing install their own.
    readdirMock().mockRejectedValue(
      Object.assign(new Error("no such directory"), { code: "ENOENT" }),
    );
  });

  /**
   * `readdir` is Node's overloaded signature, which the mock helper cannot describe well enough for a
   * test that dispatches on which directory it was given. The cast goes through `unknown` so the
   * double's own arguments stay typed at the call sites below.
   */
  const readdirMock = () => fs.promises.readdir as unknown as Mock;

  describe("readFile", () => {
    it("defaults to the draft scope", async () => {
      vi.mocked(fs.promises.readFile).mockResolvedValue("{}");

      const out = await fsDataStore.readFile("poems");

      expect(out).toBe("{}");
      expect(fs.promises.readFile).toHaveBeenCalledWith(
        "./src/data/draft/poems.json",
        "utf8",
      );
    });

    it("reads the live scope when asked", async () => {
      vi.mocked(fs.promises.readFile).mockResolvedValue("live");

      const out = await fsDataStore.readFile("poems", "live");

      expect(out).toBe("live");
      expect(fs.promises.readFile).toHaveBeenCalledWith(
        "./src/data/live/poems.json",
        "utf8",
      );
    });
  });

  describe("writeFile", () => {
    it("writes history first, then the current file - same order as writeVersionedDataFile", async () => {
      const file = { name: "poems", timestamp: 111, data: { a: 1 } };

      await fsDataStore.writeFile("poems", file);

      expect(writeCalls()[0]?.[0]).toMatch(
        /^\.\/src\/data\/history\/draft\/poems\/111\.json$/,
      );
      expect(writeCalls()[1]?.[0]).toBe("./src/data/draft/poems.json");
    });

    it("writes byte-identical JSON to both history and current file", async () => {
      const file = { name: "poems", timestamp: 222, data: { a: 1 } };

      await fsDataStore.writeFile("poems", file);

      const historyJson = writeCalls()[0]?.[1];
      const currentJson = writeCalls()[1]?.[1];

      expect(historyJson).toBe(currentJson);
      // Two-space indent plus trailing newline is what the old serializer produced.
      expect(currentJson).toBe(`${JSON.stringify(file, null, 2)}\n`);
    });

    it("creates the history directory recursively", async () => {
      await fsDataStore.writeFile("web-experience", {
        name: "web-experience",
        timestamp: 333,
        data: [],
      });

      expect(fs.promises.mkdir).toHaveBeenCalledWith(
        "./src/data/history/draft/web-experience",
        { recursive: true },
      );
    });

    it("falls back to Date.now for the snapshot name when the value carries no timestamp", async () => {
      const before = Date.now();

      await fsDataStore.writeFile("landing", { name: "landing", data: {} });

      const after = Date.now();
      const snapshotPath = writeCalls()[0]?.[0] as string;
      const stamp = Number(snapshotPath.match(/\/(\d+)\.json$/)?.[1]);

      // The filename is stamped, but the payload keeps its original `name`/`data` shape and gains
      // no timestamp field - matching `writeVersionedDataFile`, which stamps the snapshot from the
      // caller's value rather than rewriting that value. The editor path always supplies a
      // timestamp (the resource upsert helpers stamp it), so this fallback only ever fires for a
      // caller that forgot to, and silently keeping the payload intact is the safer reading of it.
      expect(stamp).toBeGreaterThanOrEqual(before);
      expect(stamp).toBeLessThanOrEqual(after);

      const written = JSON.parse(writeCalls()[0]?.[1] as string);
      expect(written).toEqual({ name: "landing", data: {} });
      expect(written.timestamp).toBeUndefined();
    });
  });

  describe("ensureBaselineSnapshot", () => {
    it("copies the current file into history under its own timestamp", async () => {
      vi.mocked(fs.promises.readFile).mockResolvedValue(
        JSON.stringify({ name: "poems", timestamp: 123, data: { old: true } }),
      );

      const created = await fsDataStore.ensureBaselineSnapshot("poems");

      expect(created).toBe(true);
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        "./src/data/history/draft/poems/123.json",
        '{"name":"poems","timestamp":123,"data":{"old":true}}\n',
      );
    });

    it("skips when a snapshot for that timestamp already exists", async () => {
      vi.mocked(fs.promises.readFile).mockResolvedValue(
        JSON.stringify({ name: "poems", timestamp: 123, data: {} }),
      );
      vi.mocked(fs.promises.access).mockResolvedValue(undefined);

      const created = await fsDataStore.ensureBaselineSnapshot("poems");

      expect(created).toBe(false);
      expect(fs.promises.writeFile).not.toHaveBeenCalled();
    });

    it("skips when the current file has no numeric timestamp", async () => {
      vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify({}));

      const created = await fsDataStore.ensureBaselineSnapshot("poems");

      expect(created).toBe(false);
      expect(fs.promises.writeFile).not.toHaveBeenCalled();
    });

    it("returns false rather than throwing when the file is missing", async () => {
      vi.mocked(fs.promises.readFile).mockRejectedValue(new Error("missing"));

      await expect(fsDataStore.ensureBaselineSnapshot("poems")).resolves.toBe(
        false,
      );
    });

    it("normalizes a snapshot with no trailing newline to exactly one", async () => {
      vi.mocked(fs.promises.readFile).mockResolvedValue('{"timestamp":9}\r\n');

      await fsDataStore.ensureBaselineSnapshot("poems");

      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        "./src/data/history/draft/poems/9.json",
        '{"timestamp":9}\n',
      );
    });
  });

  describe("release", () => {
    const draftJson = JSON.stringify(
      { name: "poems", timestamp: 300, data: { new: true } },
      null,
      2,
    );

    it("copies draft onto live after snapshotting the outgoing live version", async () => {
      vi.mocked(fs.promises.readFile).mockImplementation(async (p) => {
        const path = String(p);
        if (path.includes("/live/")) {
          return JSON.stringify({ name: "poems", timestamp: 100, data: {} });
        }
        return draftJson;
      });

      const releasedAt = await fsDataStore.release("poems");

      expect(releasedAt).toBe(300);

      // The snapshot of the version being replaced must be written before live itself is overwritten.
      const writePaths = vi
        .mocked(fs.promises.writeFile)
        .mock.calls.map((c) => c[0]);
      expect(writePaths[0]).toBe("./src/data/history/live/poems/100.json");
      expect(writePaths[1]).toBe("./src/data/live/poems.json");

      const livePayload = vi.mocked(fs.promises.writeFile).mock.calls[1]?.[1];
      expect(JSON.parse(livePayload as string).timestamp).toBe(300);
    });

    it("writes live when no previous live version exists", async () => {
      vi.mocked(fs.promises.readFile).mockImplementation(async (p) => {
        if (String(p).includes("/live/")) {
          throw Object.assign(new Error("missing"), { code: "ENOENT" });
        }
        return draftJson;
      });

      await expect(fsDataStore.release("poems")).resolves.toBe(300);

      expect(vi.mocked(fs.promises.writeFile).mock.calls).toHaveLength(1);
      expect(vi.mocked(fs.promises.writeFile).mock.calls[0]?.[0]).toBe(
        "./src/data/live/poems.json",
      );
    });

    it("refuses to release a draft with no numeric timestamp", async () => {
      vi.mocked(fs.promises.readFile).mockResolvedValue(
        JSON.stringify({ name: "poems", data: {} }),
      );
      await expect(() => fsDataStore.release("poems")).rejects.toThrow();
      expect(fs.promises.writeFile).not.toHaveBeenCalled();
    });
  });

  describe("saved versions", () => {
    const draftDir = "./src/data/history/draft/poems";
    const liveDir = "./src/data/history/live/poems";
    // The flat layout `#lib/file` wrote before draft/live tiers existed, and the only place most of
    // this site's real saved versions have ever lived.
    const flatDir = "./src/data/history/poems";

    /** Install a listing keyed by the exact directory the store asked for. */
    const listDirs = (dirs: Record<string, string[]>) => {
      readdirMock().mockImplementation((dir: string) => {
        if (dir in dirs) return Promise.resolve(dirs[dir]);

        return Promise.reject(
          Object.assign(new Error("no such directory"), { code: "ENOENT" }),
        );
      });
    };

    const listedDirs = () =>
      readdirMock().mock.calls.map((call) => String(call[0]));

    it("lists the tiers it holds, newest first", async () => {
      listDirs({
        [draftDir]: ["1000.json", "3000.json"],
        [liveDir]: ["2000.json"],
        [flatDir]: [],
      });
      const listed = await fsDataStore.listHistory("poems");
      expect(listed).toEqual([
        { timestamp: 3000, scope: "draft" },
        { timestamp: 2000, scope: "live" },
        { timestamp: 1000, scope: "draft" },
      ]);
    });

    it("orders by the number, not by the filename a listing returns", async () => {
      listDirs({
        [draftDir]: ["999999999999.json", "1000000000000.json"],
        [liveDir]: [],
        [flatDir]: [],
      });
      const listed = await fsDataStore.listHistory("poems");

      // Both names are from 2001, and a filename sort puts the 12-digit one after the 13-digit one.
      // Sorting by name would hand a screen the oldest saved versions and label them the newest.
      expect(listed.map((entry) => entry.timestamp)).toEqual([
        1000000000000, 999999999999,
      ]);
    });

    it("reads the flat history a heavily edited key actually has", async () => {
      listDirs({
        [draftDir]: [],
        [liveDir]: [],
        [flatDir]: ["1686461727106.json"],
      });
      const entries = await fsDataStore.listHistory("poems");

      expect(entries).toEqual([{ timestamp: 1686461727106, scope: "legacy" }]);
      // Not merely tolerated: the directory is opened, so what sits in it is found.
      expect(listedDirs()).toContain(flatDir);
    });

    it("reports no versions for a key whose tiers were never written", async () => {
      await expect(
        fsDataStore.listHistory("terms-of-service"),
      ).resolves.toEqual([]);
      expect(writeCalls()).toHaveLength(0);
    });

    it("does not read a closed directory as a key with no history", async () => {
      readdirMock().mockRejectedValue(
        Object.assign(new Error("EACCES"), { code: "EACCES" }),
      );
      await expect(() => fsDataStore.listHistory("poems")).rejects.toThrow(
        "EACCES",
      );
    });

    it("keeps the newest versions when the list is capped", async () => {
      listDirs({
        [draftDir]: [
          "5.json",
          "6.json",
          "7.json",
          "8.json",
          "9.json",
          "4.json",
        ],
        [liveDir]: [],
        [flatDir]: [],
      });
      const entries = await fsDataStore.listHistory("poems", { limit: 5 });

      expect(entries.map((entry) => entry.timestamp)).toEqual([9, 8, 7, 6, 5]);
    });

    it("reads one tier when the caller names one", async () => {
      listDirs({
        [draftDir]: ["1000.json"],
        [liveDir]: ["2000.json"],
        [flatDir]: ["3000.json"],
      });
      const entries = await fsDataStore.listHistory("poems", { scope: "live" });

      expect(entries).toEqual([{ timestamp: 2000, scope: "live" }]);
      expect(listedDirs()).toEqual([liveDir]);
    });

    it("ignores names that are not canonical snapshots", async () => {
      listDirs({
        [draftDir]: [
          "notes.txt",
          "draft.json",
          "01000.json",
          "0.json",
          "2000.json",
        ],
        [liveDir]: [],
        [flatDir]: [],
      });
      const entries = await fsDataStore.listHistory("poems");

      // `01000.json` and `0.json` are excluded on purpose. A listing that reported them would name a
      // version the store then could not read back, because it would look for a differently spelled file.
      expect(entries).toEqual([{ timestamp: 2000, scope: "draft" }]);
    });

    it("lists saved versions without writing anything at all", async () => {
      listDirs({
        [draftDir]: ["1000.json"],
        [liveDir]: [],
        [flatDir]: [],
      });
      // The listing is only half of this test: `readHistory` then reads the file it listed, and the
      // beforeEach default mock rejects every read, which is what the other tests lean on.
      vi.mocked(fs.promises.readFile).mockResolvedValue("1000 snapshot");

      await fsDataStore.listHistory("poems");
      await fsDataStore.readHistory("poems", 1000, "draft");

      expect(writeCalls()).toHaveLength(0);
      expect(fs.promises.mkdir).not.toHaveBeenCalled();
    });

    it("reads a snapshot out of the tier it was listed in", async () => {
      vi.mocked(fs.promises.readFile).mockResolvedValue("snapshot 2000");

      const text = await fsDataStore.readHistory("poems", 2000, "live");

      expect(text).toBe("snapshot 2000");
      expect(fs.promises.readFile).toHaveBeenCalledWith(
        "./src/data/history/live/poems/2000.json",
        "utf8",
      );
    });

    it("reads a legacy snapshot out of the flat layout it was listed in", async () => {
      vi.mocked(fs.promises.readFile).mockResolvedValue("flat snapshot");

      await fsDataStore.readHistory("poems", 1686461727106, "legacy");

      expect(fs.promises.readFile).toHaveBeenCalledWith(
        "./src/data/history/poems/1686461727106.json",
        "utf8",
      );
    });

    it("refuses a missing snapshot instead of answering an empty read", async () => {
      // An empty string is the shape that would let a restore overwrite a real file with nothing, so a
      // snapshot the disk does not have has to surface as a refusal.
      vi.mocked(fs.promises.readFile).mockRejectedValue(
        Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
      );
      await expect(() =>
        fsDataStore.readHistory("poems", 3000, "draft"),
      ).rejects.toThrow(
        "No draft snapshot of poems at version 3000 is held in history.",
      );
    });

    it("names a missing snapshot the way the other store would", async () => {
      vi.mocked(fs.promises.readFile).mockRejectedValue(
        Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
      );
      const cause = await fsDataStore
        .readHistory("poems", 3000, "draft")
        .then(() => undefined)
        .catch((e: unknown) => e);

      expect(isMissingSnapshot(cause)).toBe(true);
    });

    it("does not report an unreadable snapshot as a version that is not there", async () => {
      // A permission failure is not "this version was deleted". Reading it as missing would tell an
      // editor the version is gone while the file is still sitting there unread.
      vi.mocked(fs.promises.readFile).mockRejectedValue(
        Object.assign(new Error("EACCES"), { code: "EACCES" }),
      );
      const cause = await fsDataStore
        .readHistory("poems", 3000, "draft")
        .then(() => undefined)
        .catch((e: unknown) => e);

      expect(isMissingSnapshot(cause)).toBe(false);
    });

    it("refuses a version number that is not a real timestamp", async () => {
      const cause = await fsDataStore.readHistory("poems", 0).then(
        () => undefined,
        (e: unknown) => e,
      );

      // `e500` throws Kit's HttpError, which carries its text in `body` and has no `message` at all, so
      // the assertion is on the status an editor action can turn into a message plus the text a caller
      // would read out of the body.
      expect(isHttpError(cause, 500)).toBe(true);

      if (isHttpError(cause)) {
        expect(cause.body.message).toContain(
          "Cannot read a poems version without a valid numeric timestamp.",
        );
      }
      // Without the guard, `0` reached the path builder and the store went looking for a file named
      // `0.json` that no listing would ever have admitted to reading.
      expect(fs.promises.readFile).not.toHaveBeenCalled();
    });
  });
});
