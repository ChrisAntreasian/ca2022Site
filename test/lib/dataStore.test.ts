import { describe, it, expect, vi, beforeEach } from "vitest";
import { fsDataStore } from "../../src/lib/dataStore.server";

// Mock fs module
vi.mock("fs", () => ({
  promises: {
    writeFile: vi.fn(),
    readFile: vi.fn(),
    mkdir: vi.fn(),
    access: vi.fn(),
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
  });

  describe("readFile", () => {
    it("reads the src/data path for a content key", async () => {
      vi.mocked(fs.promises.readFile).mockResolvedValue("{}");

      const out = await fsDataStore.readFile("poems");

      expect(out).toBe("{}");
      expect(fs.promises.readFile).toHaveBeenCalledWith(
        "./src/data/poems.json",
        "utf8",
      );
    });
  });

  describe("writeFile", () => {
    it("writes history first, then the current file - same order as writeVersionedDataFile", async () => {
      const file = { name: "poems", timestamp: 111, data: { a: 1 } };

      await fsDataStore.writeFile("poems", file);

      expect(writeCalls()[0]?.[0]).toMatch(
        /^\.\/src\/data\/history\/poems\/111\.json$/,
      );
      expect(writeCalls()[1]?.[0]).toBe("./src/data/poems.json");
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
        "./src/data/history/web-experience",
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
        "./src/data/history/poems/123.json",
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
        "./src/data/history/poems/9.json",
        '{"timestamp":9}\n',
      );
    });
  });
});
