/**
 * gpt-image MCP Server — OpenAI Images API Service
 * Builds the exact requests the Images API expects, saves the returned image,
 * and translates API errors into actionable messages.
 */

import * as fs from "node:fs";
import * as path from "node:path";

const BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ImageOptions {
  model?: string;
  size?: string;
  quality?: string;
  outputFormat?: string;
  outputCompression?: number;
  background?: string;
  moderation?: string;
  outputDir?: string;
  filename?: string;
}

export interface EditOptions extends ImageOptions {
  maskPath?: string;
}

export interface ImageResult {
  filePath: string;
  usage?: Record<string, unknown>;
}

// ─── Request builders ───────────────────────────────────────────────────────

function getApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing API key. Set the OPENAI_API_KEY environment variable.");
  }
  return apiKey;
}

/** JSON body for /images/generations. Undefined options are omitted. */
export function buildGenerationBody(prompt: string, options: ImageOptions): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: options.model,
    prompt,
  };
  if (options.size) body.size = options.size;
  if (options.quality) body.quality = options.quality;
  if (options.outputFormat) body.output_format = options.outputFormat;
  if (options.outputCompression !== undefined) body.output_compression = options.outputCompression;
  if (options.background) body.background = options.background;
  if (options.moderation) body.moderation = options.moderation;
  return body;
}

/**
 * FormData for /images/edits. Input images go under a repeated `image[]` key,
 * which the official curl examples use even for a single image.
 */
export function buildEditForm(imagePaths: string[], prompt: string, options: EditOptions): FormData {
  const form = new FormData();
  form.append("model", String(options.model));
  form.append("prompt", prompt);

  for (const imagePath of imagePaths) {
    const resolved = path.resolve(imagePath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Input image not found: ${resolved}`);
    }
    const buffer = fs.readFileSync(resolved);
    form.append("image[]", new Blob([buffer], { type: getMimeType(resolved) }), path.basename(resolved));
  }

  if (options.maskPath) {
    const resolvedMask = path.resolve(options.maskPath);
    if (!fs.existsSync(resolvedMask)) {
      throw new Error(`Mask image not found: ${resolvedMask}`);
    }
    const maskBuffer = fs.readFileSync(resolvedMask);
    form.append("mask", new Blob([maskBuffer], { type: "image/png" }), path.basename(resolvedMask));
  }

  if (options.size) form.append("size", options.size);
  if (options.quality) form.append("quality", options.quality);
  if (options.outputFormat) form.append("output_format", options.outputFormat);
  if (options.outputCompression !== undefined) {
    form.append("output_compression", String(options.outputCompression));
  }
  if (options.background) form.append("background", options.background);

  return form;
}

// ─── Errors ─────────────────────────────────────────────────────────────────

/**
 * Two documented error shapes: the generic one carries `message`, while the
 * moderation one has no `message` and carries `moderation_details` instead.
 */
export function formatApiError(
  status: number,
  json: Record<string, any> | null,
  statusText: string
): string {
  const error = json?.error;
  const code = error?.code ? ` (${error.code})` : "";

  let detail: string = error?.message ?? statusText;
  const moderation = error?.moderation_details;
  if (!error?.message && moderation) {
    const stage = moderation.moderation_stage ? `${moderation.moderation_stage} stage` : "moderation";
    const categories = Array.isArray(moderation.categories)
      ? moderation.categories.join(", ")
      : "unspecified";
    detail = `blocked at ${stage} for: ${categories}`;
  }

  return `OpenAI API ${status}${code}: ${detail}`;
}

async function request(endpoint: string, init: RequestInit): Promise<Record<string, any>> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...init,
    headers: { Authorization: `Bearer ${getApiKey()}`, ...(init.headers ?? {}) },
  });

  const json = (await response.json().catch(() => null)) as Record<string, any> | null;

  if (!response.ok) {
    throw new Error(formatApiError(response.status, json, response.statusText));
  }
  if (!json) {
    throw new Error(`OpenAI API ${response.status}: unreadable response body.`);
  }
  return json;
}

// ─── Response handling ──────────────────────────────────────────────────────

/** GPT image models always return base64 data; `url` is a dall-e-only field. */
export function saveImage(
  json: Record<string, any>,
  outputDir: string,
  filename: string
): ImageResult {
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("No image data in the API response (data[0].b64_json is missing).");
  }

  const dir = ensureDir(outputDir);
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, Buffer.from(b64, "base64"));

  return { filePath, usage: json.usage };
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function generateImage(prompt: string, options: ImageOptions): Promise<ImageResult> {
  const json = await request("/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildGenerationBody(prompt, options)),
  });
  return saveImage(
    json,
    options.outputDir || process.cwd(),
    options.filename || generateFilename(prompt, options.outputFormat)
  );
}

export async function editImage(
  imagePaths: string[],
  prompt: string,
  options: EditOptions
): Promise<ImageResult> {
  const form = buildEditForm(imagePaths, prompt, options);
  const json = await request("/images/edits", { method: "POST", body: form });
  return saveImage(
    json,
    options.outputDir || path.dirname(path.resolve(imagePaths[0]!)),
    options.filename || generateFilename(prompt, options.outputFormat, "gptimage_edit")
  );
}

// ─── Utilities ──────────────────────────────────────────────────────────────

export function generateFilename(prompt: string, outputFormat = "png", prefix = "gptimage"): string {
  const slug = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join("_");
  return `${prefix}_${slug}_${Date.now()}.${extensionFor(outputFormat)}`;
}

export function extensionFor(outputFormat: string): string {
  return outputFormat === "jpeg" ? "jpg" : outputFormat;
}

function ensureDir(dirPath: string): string {
  const resolved = path.resolve(dirPath);
  if (!fs.existsSync(resolved)) {
    fs.mkdirSync(resolved, { recursive: true });
  }
  return resolved;
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
  };
  return mimeTypes[ext] || "image/png";
}
