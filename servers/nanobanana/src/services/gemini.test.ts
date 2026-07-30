import { afterAll, beforeAll, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const PNG_1X1_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nanobanana-svc-"));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function fakeResponse(mimeType: string | undefined) {
  return {
    candidates: [
      {
        content: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: PNG_1X1_B64,
              },
            },
          ],
        },
      },
    ],
  };
}

// ─── extensionForMimeType ───────────────────────────────────────────────────

test("extensionForMimeType: maps each known MIME type to its extension", async () => {
  const { extensionForMimeType } = await import("./gemini.js");
  expect(extensionForMimeType("image/png")).toBe("png");
  expect(extensionForMimeType("image/jpeg")).toBe("jpg");
  expect(extensionForMimeType("image/webp")).toBe("webp");
  expect(extensionForMimeType("image/gif")).toBe("gif");
});

test("extensionForMimeType: unknown or absent MIME type returns undefined", async () => {
  const { extensionForMimeType } = await import("./gemini.js");
  expect(extensionForMimeType("image/bmp")).toBeUndefined();
  expect(extensionForMimeType(undefined)).toBeUndefined();
});

// ─── correctExtension ───────────────────────────────────────────────────────

test("correctExtension: the real defect — .png requested but the API returns JPEG", async () => {
  const { correctExtension } = await import("./gemini.js");
  expect(correctExtension("smoke_nb.png", "image/jpeg")).toBe("smoke_nb.jpg");
});

test("correctExtension: MIME type absent — filename is returned unchanged", async () => {
  const { correctExtension } = await import("./gemini.js");
  expect(correctExtension("smoke_nb.png", undefined)).toBe("smoke_nb.png");
});

test("correctExtension: unknown MIME type — filename is returned unchanged", async () => {
  const { correctExtension } = await import("./gemini.js");
  expect(correctExtension("smoke_nb.png", "image/bmp")).toBe("smoke_nb.png");
});

test("correctExtension: filename without an extension gets one appended", async () => {
  const { correctExtension } = await import("./gemini.js");
  expect(correctExtension("smoke_nb", "image/jpeg")).toBe("smoke_nb.jpg");
});

test("correctExtension: matching extension and MIME type is a no-op", async () => {
  const { correctExtension } = await import("./gemini.js");
  expect(correctExtension("smoke_nb.webp", "image/webp")).toBe("smoke_nb.webp");
});

// ─── extractAndSaveImage: end-to-end filename correction ──────────────────

test("extractAndSaveImage: writes to the MIME-corrected path and returns it", async () => {
  const svc = (await import("./gemini.js")) as any;
  const result = svc.extractAndSaveImage(fakeResponse("image/jpeg"), tmpDir, "smoke_nb.png");

  expect(result.filePath).toBe(path.join(tmpDir, "smoke_nb.jpg"));
  expect(fs.existsSync(result.filePath)).toBe(true);
  expect(fs.existsSync(path.join(tmpDir, "smoke_nb.png"))).toBe(false);
});

test("extractAndSaveImage: unknown MIME type keeps the requested filename", async () => {
  const svc = (await import("./gemini.js")) as any;
  const result = svc.extractAndSaveImage(fakeResponse("image/bmp"), tmpDir, "keep_me.png");

  expect(result.filePath).toBe(path.join(tmpDir, "keep_me.png"));
  expect(fs.existsSync(result.filePath)).toBe(true);
});
