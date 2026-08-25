import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

import { ApiErrorCode } from "../../src/types/api";
import { isAppServiceError } from "../../src/lib/errors";
import {
  deleteTravelTicketObject,
  downloadPublicObject,
  downloadTravelTicket,
  uploadEventCover,
  uploadTravelTicket,
} from "../../src/server/services/storage-service";

describe("filesystem storage", () => {
  let storageDir = "";
  const previousStorageDir = process.env.STORAGE_DIR;
  const previousPublicUrl = process.env.S3_PUBLIC_URL;

  before(async () => {
    storageDir = await mkdtemp(path.join(tmpdir(), "pt-files-"));
    process.env.STORAGE_DIR = storageDir;
    process.env.S3_PUBLIC_URL = "http://localhost:3000/files";
  });

  after(async () => {
    process.env.STORAGE_DIR = previousStorageDir;
    process.env.S3_PUBLIC_URL = previousPublicUrl;
    await rm(storageDir, { recursive: true, force: true });
  });

  it("stores an event cover and serves it as a public object", async () => {
    const body = Buffer.from("cover-bytes");
    const url = await uploadEventCover({
      body,
      contentType: "image/png",
    });
    assert.match(url, /^http:\/\/localhost:3000\/files\/events\/covers\/.+\.png$/);
    const key = url.replace("http://localhost:3000/files/", "");
    const stored = await downloadPublicObject(key);
    assert.equal(stored.contentType, "image/png");
    assert.equal(stored.body.toString(), "cover-bytes");
    const onDisk = await readFile(path.join(storageDir, key));
    assert.equal(onDisk.toString(), "cover-bytes");
  });

  it("rejects ticket keys on the public download path", async () => {
    const uploaded = await uploadTravelTicket({
      body: Buffer.from("%PDF-ticket"),
      contentType: "application/pdf",
    });
    const key = uploaded.url.replace("http://localhost:3000/files/", "");
    await assert.rejects(
      () => downloadPublicObject(key),
      (error: unknown) =>
        isAppServiceError(error) && error.code === ApiErrorCode.NotFound,
    );
    const fileName = key.split("/").pop() ?? "";
    const ticket = await downloadTravelTicket(fileName);
    assert.equal(ticket.contentType, "application/pdf");
    await deleteTravelTicketObject(uploaded.url);
    await assert.rejects(
      () => downloadTravelTicket(fileName),
      (error: unknown) =>
        isAppServiceError(error) && error.code === ApiErrorCode.NotFound,
    );
  });

  it("ignores leftover MinIO :9000 public URLs and uses the app /files origin", async () => {
    const previousAuth = process.env.BETTER_AUTH_URL;
    process.env.S3_PUBLIC_URL = "http://localhost:9000/paytracker";
    process.env.BETTER_AUTH_URL = "http://localhost:3000";
    try {
      const url = await uploadEventCover({
        body: Buffer.from("legacy-url"),
        contentType: "image/jpeg",
      });
      assert.match(
        url,
        /^http:\/\/localhost:3000\/files\/events\/covers\/.+\.jpg$/,
      );
    } finally {
      process.env.S3_PUBLIC_URL = "http://localhost:3000/files";
      process.env.BETTER_AUTH_URL = previousAuth;
    }
  });
});
