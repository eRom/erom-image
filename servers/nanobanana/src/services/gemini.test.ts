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

/** The real shape returned by gemini-3-pro-image-preview on 2026-08-05: an
 *  empty candidate, no safetyRatings, no promptFeedback. */
function imageOtherResponse() {
  return {
    candidates: [{ content: {}, finishReason: "IMAGE_OTHER", index: 0 }],
    modelVersion: "gemini-3-pro-image-preview",
  };
}

function safetyBlockResponse() {
  return {
    candidates: [
      {
        content: {},
        finishReason: "IMAGE_SAFETY",
        safetyRatings: [{ category: "HARM_CATEGORY_DANGEROUS_CONTENT", probability: "HIGH" }],
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

// ─── describeEmptyResponse ──────────────────────────────────────────────────

test("describeEmptyResponse: the real defect — IMAGE_OTHER is never called a safety block", async () => {
  const { describeEmptyResponse } = await import("./gemini.js");
  const message = describeEmptyResponse(imageOtherResponse());

  expect(message).toContain("IMAGE_OTHER");
  expect(message).not.toContain("safety filter");
  expect(message).not.toContain("refused");
});

test("describeEmptyResponse: a genuine content block is reported as one", async () => {
  const { describeEmptyResponse } = await import("./gemini.js");
  const message = describeEmptyResponse(safetyBlockResponse());

  expect(message).toContain("refused");
  expect(message).toContain("IMAGE_SAFETY");
  expect(message).toContain("HARM_CATEGORY_DANGEROUS_CONTENT");
});

test("describeEmptyResponse: promptFeedback.blockReason counts as a content block", async () => {
  const { describeEmptyResponse } = await import("./gemini.js");
  const message = describeEmptyResponse({
    candidates: [{ content: {} }],
    promptFeedback: { blockReason: "PROHIBITED_CONTENT", blockReasonMessage: "nope" },
  });

  expect(message).toContain("refused");
  expect(message).toContain("PROHIBITED_CONTENT");
  expect(message).toContain("nope");
});

test("describeEmptyResponse: an empty response with no reason says exactly that", async () => {
  const { describeEmptyResponse } = await import("./gemini.js");
  const message = describeEmptyResponse({});

  expect(message).toContain("no finishReason");
  expect(message).not.toContain("safety");
});

// ─── isRecoverableFailure ───────────────────────────────────────────────────

test("isRecoverableFailure: IMAGE_OTHER is retried — it is intermittent", async () => {
  const { isRecoverableFailure } = await import("./gemini.js");
  expect(isRecoverableFailure(imageOtherResponse())).toBe(true);
});

test("isRecoverableFailure: a content refusal is stable, never retried", async () => {
  const { isRecoverableFailure } = await import("./gemini.js");
  expect(isRecoverableFailure(safetyBlockResponse())).toBe(false);
});

test("isRecoverableFailure: a response carrying an image is left alone", async () => {
  const { isRecoverableFailure } = await import("./gemini.js");
  expect(isRecoverableFailure(fakeResponse("image/png"))).toBe(false);
});

test("isRecoverableFailure: an empty response with no reason at all is retried", async () => {
  const { isRecoverableFailure } = await import("./gemini.js");
  expect(isRecoverableFailure({})).toBe(true);
});

// ─── resolveWithRecovery ────────────────────────────────────────────────────

const PRO = "gemini-3-pro-image-preview";

/** Replays a scripted sequence of responses, recording which model each call used. */
function scriptedCaller(responses: any[]) {
  const calls: string[] = [];
  return {
    calls,
    call: async (model: string) => {
      calls.push(model);
      return responses[calls.length - 1];
    },
  };
}

test("resolveWithRecovery: a first-try success calls the API exactly once", async () => {
  const { resolveWithRecovery } = await import("./gemini.js");
  const caller = scriptedCaller([fakeResponse("image/png")]);

  const result = await resolveWithRecovery(PRO, caller.call);

  expect(result.fallbackFrom).toBeUndefined();
  expect(caller.calls).toEqual([PRO]);
});

test("resolveWithRecovery: an intermittent IMAGE_OTHER is cleared by retrying the same model", async () => {
  const { resolveWithRecovery } = await import("./gemini.js");
  const caller = scriptedCaller([imageOtherResponse(), fakeResponse("image/png")]);

  const result = await resolveWithRecovery(PRO, caller.call);

  expect(result.fallbackFrom).toBeUndefined();
  expect(caller.calls).toEqual([PRO, PRO]);
});

test("resolveWithRecovery: two empty responses drop to the default model and say so", async () => {
  const { resolveWithRecovery } = await import("./gemini.js");
  const { DEFAULT_MODEL } = await import("../constants.js");
  const caller = scriptedCaller([
    imageOtherResponse(),
    imageOtherResponse(),
    fakeResponse("image/png"),
  ]);

  const result = await resolveWithRecovery(PRO, caller.call);

  expect(result.fallbackFrom).toBe(PRO);
  expect(caller.calls).toEqual([PRO, PRO, DEFAULT_MODEL]);
});

test("resolveWithRecovery: a content refusal is never retried", async () => {
  const { resolveWithRecovery } = await import("./gemini.js");
  const caller = scriptedCaller([safetyBlockResponse()]);

  const result = await resolveWithRecovery(PRO, caller.call);

  expect(caller.calls).toEqual([PRO]);
  expect(result.fallbackFrom).toBeUndefined();
});

test("resolveWithRecovery: the default model retries once, then gives up without a second fallback", async () => {
  const { resolveWithRecovery } = await import("./gemini.js");
  const { DEFAULT_MODEL } = await import("../constants.js");
  const caller = scriptedCaller([imageOtherResponse(), imageOtherResponse()]);

  await expect(resolveWithRecovery(DEFAULT_MODEL, caller.call)).rejects.toThrow("twice");
  expect(caller.calls).toEqual([DEFAULT_MODEL, DEFAULT_MODEL]);
});

test("resolveWithRecovery: when everything fails, the error names both models", async () => {
  const { resolveWithRecovery } = await import("./gemini.js");
  const { DEFAULT_MODEL } = await import("../constants.js");
  const caller = scriptedCaller([
    imageOtherResponse(),
    imageOtherResponse(),
    imageOtherResponse(),
  ]);

  await expect(resolveWithRecovery(PRO, caller.call)).rejects.toThrow(
    new RegExp(`${PRO}.*${DEFAULT_MODEL}`, "s")
  );
  expect(caller.calls).toEqual([PRO, PRO, DEFAULT_MODEL]);
});

// ─── hasImageParts ──────────────────────────────────────────────────────────

test("hasImageParts: distinguishes a real candidate from an empty one", async () => {
  const { hasImageParts } = await import("./gemini.js");
  expect(hasImageParts(fakeResponse("image/png"))).toBe(true);
  expect(hasImageParts(imageOtherResponse())).toBe(false);
  expect(hasImageParts({})).toBe(false);
  expect(hasImageParts({ candidates: [{ content: { parts: [] } }] })).toBe(false);
});
