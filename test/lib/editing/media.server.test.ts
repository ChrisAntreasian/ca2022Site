import { describe, expect, it, vi } from "vitest";

import { deleteMediaByUrl, persistUploadedMedia } from "../../../src/lib/editing/core/media.server";

describe("media server helpers", () => {
  it("uploads files with the configured prefix and returns a normalized asset", async () => {
    const uploadFile = vi.fn(async () => ({ Location: "https://cdn.example.com/uploads/test.png" }));
    const file = new File(["hello"], "photo.png", { type: "image/png" });

    const asset = await persistUploadedMedia({
      file,
      prefix: "the-souljuicer",
      uploadFile,
      errorMessage: "Failed to upload Souljuicer media.",
      now: new Date("2024-01-01T00:00:00.000Z"),
    });

    expect(uploadFile).toHaveBeenCalledTimes(1);
    expect(uploadFile.mock.calls[0][0]).toContain("the-souljuicer/");
    expect(asset.url).toBe("https://cdn.example.com/uploads/test.png");
    expect(asset.name).toBe("photo.png");
  });

  it("deletes media using the URL key when present", async () => {
    const deleteFile = vi.fn(async () => undefined);

    await deleteMediaByUrl(
      "https://cdn.example.com/uploads/old.png",
      deleteFile,
    );

    expect(deleteFile).toHaveBeenCalledWith("uploads/old.png");
  });
});
