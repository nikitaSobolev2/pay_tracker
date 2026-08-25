import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

  it("reads a MinIO XL object directory via part.1", async () => {
    const key =
      "travels/covers/3c6d0e06-ace0-4461-987d-4e66c641e803.png";
    const objectDir = path.join(storageDir, key);
    await mkdir(objectDir, { recursive: true });
    await writeFile(path.join(objectDir, "xl.meta"), "minio-meta");
    await writeFile(path.join(objectDir, "part.1"), "cover-from-minio");
    const stored = await downloadPublicObject(key);
    assert.equal(stored.contentType, "image/png");
    assert.equal(stored.body.toString(), "cover-from-minio");
  });

  it("reads a PNG inlined in xl.meta when part.1 is missing", async () => {
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from("cover"),
      Buffer.from("IEND"),
      Buffer.from([0, 0, 0, 0]),
    ]);
    const key =
      "travels/covers/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.png";
    const objectDir = path.join(storageDir, key);
    await mkdir(objectDir, { recursive: true });
    await writeFile(
      path.join(objectDir, "xl.meta"),
      Buffer.concat([Buffer.from("hdr"), png]),
    );
    const stored = await downloadPublicObject(key);
    assert.equal(stored.contentType, "image/png");
    assert.equal(Buffer.compare(stored.body, png), 0);
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
