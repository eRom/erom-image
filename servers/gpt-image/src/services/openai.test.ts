import { afterAll, beforeAll, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const PNG_1X1_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

let captured: { url: string; auth: string | null; contentType: string | null; body: any } | null = null;
let nextStatus = 200;
let nextPayload: unknown = null;
let server: ReturnType<typeof Bun.serve>;
let tmpDir: string;

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    async fetch(req) {
      const contentType = req.headers.get("content-type");
      let body: any;
      if (contentType?.includes("application/json")) {
        body = await req.json();
      } else {
        const form = await req.formData();
        body = {
          fields: Object.fromEntries(
            [...new Set([...form.keys()])].map((k) => [
              k,
              form.getAll(k).map((v) => (v instanceof File ? { name: v.name, type: v.type } : v)),
            ])
          ),
        };
      }
      captured = { url: new URL(req.url).pathname, auth: req.headers.get("authorization"), contentType, body };
      return Response.json(nextPayload, { status: nextStatus });
    },
  });

  process.env.OPENAI_BASE_URL = `http://localhost:${server.port}/v1`;
  process.env.OPENAI_API_KEY = "sk-probe";
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gptimg-svc-"));
});

afterAll(() => server.stop(true));

// Real gpt-image response shape: b64_json only in data[], no url,
// no revised_prompt (dall-e-3 only), usage with 4 fields.
const okPayload = {
  created: 1_770_000_000,
  data: [{ b64_json: PNG_1X1_B64 }],
  usage: {
    input_tokens: 34,
    input_tokens_details: { image_tokens: 0, text_tokens: 34 },
    output_tokens: 1200,
    total_tokens: 1234,
  },
  background: "opaque",
  size: "1024x1024",
  quality: "low",
  output_format: "png",
};

function writeFixtureImage(name: string): string {
  const p = path.join(tmpDir, name);
  fs.writeFileSync(p, Buffer.from(PNG_1X1_B64, "base64"));
  return p;
}

test("generateImage: POSTs JSON to /images/generations, omitting undefined fields", async () => {
  const { generateImage } = await import("./openai.js");
  nextStatus = 200;
  nextPayload = okPayload;

  const result = await generateImage("a red apple on white", {
    model: "gpt-image-2",
    size: "1024x1024",
    quality: "low",
    outputDir: tmpDir,
    filename: "apple.png",
  });

  expect(captured!.url).toBe("/v1/images/generations");
  expect(captured!.auth).toBe("Bearer sk-probe");
  expect(captured!.contentType).toContain("application/json");
  expect(captured!.body).toEqual({
    model: "gpt-image-2",
    prompt: "a red apple on white",
    size: "1024x1024",
    quality: "low",
  });
  expect(captured!.body).not.toHaveProperty("background");
  expect(captured!.body).not.toHaveProperty("output_compression");

  expect(fs.existsSync(result.filePath)).toBe(true);
  expect(fs.readFileSync(result.filePath).length).toBe(70);
  expect(result.usage).toEqual(okPayload.usage);
});

test("editImage: multipart with repeated image[], mask and optional fields", async () => {
  const { editImage } = await import("./openai.js");
  nextStatus = 200;
  nextPayload = okPayload;

  const a = writeFixtureImage("a.png");
  const b = writeFixtureImage("b.png");
  const mask = writeFixtureImage("mask.png");

  await editImage([a, b], "put Image 1 subject into Image 2 scene", {
    model: "gpt-image-2",
    maskPath: mask,
    quality: "high",
    outputFormat: "webp",
    outputCompression: 80,
    outputDir: tmpDir,
    filename: "composed.webp",
  });

  expect(captured!.url).toBe("/v1/images/edits");
  expect(captured!.contentType).toContain("multipart/form-data");

  const f = captured!.body.fields;
  expect(f["image[]"].length).toBe(2);
  expect(f["image[]"].map((x: any) => x.name)).toEqual(["a.png", "b.png"]);
  expect(f["image[]"][0].type).toBe("image/png");
  expect(f.mask.length).toBe(1);
  expect(f.mask[0].name).toBe("mask.png");
  expect(f.model).toEqual(["gpt-image-2"]);
  expect(f.prompt).toEqual(["put Image 1 subject into Image 2 scene"]);
  expect(f.quality).toEqual(["high"]);
  expect(f.output_format).toEqual(["webp"]);
  expect(f.output_compression).toEqual(["80"]);
  expect(f).not.toHaveProperty("size");
});

test("API error: message and code are relayed", async () => {
  const { generateImage } = await import("./openai.js");
  nextStatus = 400;
  // Real response captured from the API on 2026-07-30.
  nextPayload = {
    error: {
      message: "Billing hard limit has been reached.",
      type: "billing_limit_user_error",
      param: null,
      code: "billing_hard_limit_reached",
    },
  };

  expect(
    generateImage("x", { model: "gpt-image-2", outputDir: tmpDir, filename: "nope.png" })
  ).rejects.toThrow("OpenAI API 400 (billing_hard_limit_reached): Billing hard limit has been reached.");
});

test("moderation error: no message field, moderation_details used instead", async () => {
  const { formatApiError } = await import("./openai.js");
  // Documented shape, specific to the image endpoints (no message field).
  const moderationError = {
    error: {
      type: "image_generation_user_error",
      code: "moderation_blocked",
      moderation_details: { moderation_stage: "input", categories: ["harassment"] },
    },
  };

  expect(formatApiError(400, moderationError, "Bad Request")).toBe(
    "OpenAI API 400 (moderation_blocked): blocked at input stage for: harassment"
  );
});

test("error without a JSON body: falls back to statusText", async () => {
  const { formatApiError } = await import("./openai.js");
  expect(formatApiError(502, null, "Bad Gateway")).toBe("OpenAI API 502: Bad Gateway");
});

test("response without an image: explicit error", async () => {
  const { generateImage } = await import("./openai.js");
  nextStatus = 200;
  nextPayload = { created: 1, data: [] };

  expect(
    generateImage("x", { model: "gpt-image-2", outputDir: tmpDir, filename: "nope.png" })
  ).rejects.toThrow("No image data in the API response");
});

test("missing input image: fails before any network call", async () => {
  const { editImage } = await import("./openai.js");
  expect(
    editImage([path.join(tmpDir, "ghost.png")], "x", { model: "gpt-image-2" })
  ).rejects.toThrow("Input image not found");
});

test("generateFilename: slug, extension and prefix", async () => {
  const { generateFilename, extensionFor } = await import("./openai.js");
  expect(generateFilename("A Red Apple, on White!", "jpeg")).toMatch(/^gptimage_a_red_apple_on_\d+\.jpg$/);
  expect(generateFilename("x", "png", "gptimage_edit")).toMatch(/^gptimage_edit_x_\d+\.png$/);
  expect(extensionFor("webp")).toBe("webp");
});
