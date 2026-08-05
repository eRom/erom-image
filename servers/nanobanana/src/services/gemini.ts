/**
 * Nano Banana MCP Server — Gemini API Service
 * Handles all interactions with the Google GenAI API for image generation and editing.
 */

import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";
import * as path from "node:path";

import { DEFAULT_MODEL } from "../constants.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GenerateOptions {
  model?: string;
  aspectRatio?: string;
  resolution?: string;
  outputDir?: string;
  filename?: string;
}

export interface GenerateResult {
  filePath: string;
  textResponse?: string;
  /** Set when the requested model returned nothing and DEFAULT_MODEL produced the image instead. */
  fallbackFrom?: string;
}

// ─── Client Initialization ──────────────────────────────────────────────────

let _client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (_client) return _client;

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing API key. Set GEMINI_API_KEY or GOOGLE_API_KEY environment variable."
    );
  }

  _client = new GoogleGenAI({ apiKey });
  return _client;
}

// ─── Smart Filename Generation ──────────────────────────────────────────────

function generateFilename(prompt: string, prefix: string = "nanobanana"): string {
  const slug = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join("_");

  const timestamp = Date.now();
  return `${prefix}_${slug}_${timestamp}.png`;
}

// Known MIME types the Gemini image API returns, mapped to their file extension.
const MIME_TO_EXTENSION: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * Translates an image MIME type into a file extension. Returns undefined for
 * an unknown or missing MIME type — callers must not guess in that case.
 */
export function extensionForMimeType(mimeType: string | undefined): string | undefined {
  if (!mimeType) return undefined;
  return MIME_TO_EXTENSION[mimeType];
}

/**
 * Returns `filename` with its extension corrected to match `mimeType`, the
 * type actually reported by the API. The API sometimes returns a different
 * image type than the extension baked into the requested filename (e.g. a
 * `.png` name for a JPEG payload), which produces a file that lies about its
 * own content.
 *
 * If `mimeType` is missing or unrecognized, `filename` is returned unchanged
 * — never degrade a case that works today. If `filename` has no extension,
 * one is appended.
 */
export function correctExtension(filename: string, mimeType: string | undefined): string {
  const ext = extensionForMimeType(mimeType);
  if (!ext) return filename;

  const currentExt = path.extname(filename);
  const base = currentExt ? filename.slice(0, -currentExt.length) : filename;
  return `${base}.${ext}`;
}

// ─── Response Diagnostics ───────────────────────────────────────────────────

/**
 * finishReason values that mean the model refused the content itself. Retrying
 * one of these on another model just buys the same refusal one call later.
 */
const CONTENT_BLOCK_REASONS = new Set([
  "SAFETY",
  "IMAGE_SAFETY",
  "PROHIBITED_CONTENT",
  "IMAGE_PROHIBITED_CONTENT",
  "RECITATION",
  "IMAGE_RECITATION",
  "BLOCKLIST",
  "SPII",
]);

export function getFinishReason(response: any): string | undefined {
  return response?.candidates?.[0]?.finishReason;
}

export function hasImageParts(response: any): boolean {
  const parts = response?.candidates?.[0]?.content?.parts;
  return Array.isArray(parts) && parts.length > 0;
}

export function isContentBlock(response: any): boolean {
  const reason = getFinishReason(response);
  return (
    (!!reason && CONTENT_BLOCK_REASONS.has(reason)) ||
    !!response?.promptFeedback?.blockReason
  );
}

/**
 * Explains why a response carries no image, using what the API actually said:
 * `finishReason`, `promptFeedback.blockReason`, `safetyRatings`.
 *
 * Never assert a safety block we did not observe. `IMAGE_OTHER` arrives with
 * no safety rating and no block reason, and clears on a retry — calling it
 * censorship sends the caller off rewriting a prompt that was never the
 * problem. That misdiagnosis cost a full debugging session on 2026-08-04.
 */
export function describeEmptyResponse(response: any): string {
  const finishReason = getFinishReason(response);
  const blockReason = response?.promptFeedback?.blockReason;
  const safetyRatings = response?.candidates?.[0]?.safetyRatings;

  const details: string[] = [];
  if (finishReason) details.push(`finishReason: ${finishReason}`);
  if (blockReason) details.push(`blockReason: ${blockReason}`);

  const message =
    response?.candidates?.[0]?.finishMessage ||
    response?.promptFeedback?.blockReasonMessage;
  if (message) details.push(`message: ${message}`);

  if (Array.isArray(safetyRatings) && safetyRatings.length > 0) {
    details.push(`safetyRatings: ${JSON.stringify(safetyRatings)}`);
  }

  const suffix = details.length > 0 ? ` (${details.join(", ")})` : "";

  if (isContentBlock(response)) {
    return `The model refused this request on content grounds${suffix}. Reword the prompt or change the source image.`;
  }

  if (finishReason) {
    return `The API returned no image${suffix}. No content block was reported, so this is a generation failure rather than a refusal — another model or another attempt usually clears it.`;
  }

  return `The API returned no image and gave no finishReason${suffix}. Nothing in the response explains why.`;
}

/**
 * True when a response carries no image for a reason worth retrying.
 *
 * `IMAGE_OTHER` is intermittent, not deterministic: measured on 2026-08-05
 * against one banner, `gemini-3-pro-image-preview` failed 7 times in a row
 * inside one window, then succeeded 4 times out of 5 twenty minutes later on
 * the identical call. Content refusals are excluded — those are stable, and
 * retrying one only buys the same refusal a second time.
 */
export function isRecoverableFailure(response: any): boolean {
  return !hasImageParts(response) && !isContentBlock(response);
}

function ensureDir(dirPath: string): string {
  const resolved = path.resolve(dirPath);
  if (!fs.existsSync(resolved)) {
    fs.mkdirSync(resolved, { recursive: true });
  }
  return resolved;
}

/**
 * Issues the request and recovers from empty responses.
 *
 * Recovery order matters: retry the requested model first, because the failure
 * is intermittent and the caller asked for that model on purpose. Only after a
 * second empty response do we drop to DEFAULT_MODEL, and the caller is told we
 * did. A content refusal is returned untouched — extractAndSaveImage turns it
 * into the right message.
 */
export async function resolveWithRecovery(
  model: string,
  call: (model: string) => Promise<any>
): Promise<{ response: any; fallbackFrom?: string }> {
  const first = await call(model);
  if (!isRecoverableFailure(first)) return { response: first };

  const second = await call(model);
  if (!isRecoverableFailure(second)) return { response: second };

  if (model === DEFAULT_MODEL) {
    throw new Error(`${model} returned no image twice. ${describeEmptyResponse(second)}`);
  }

  const fallback = await call(DEFAULT_MODEL);
  if (!hasImageParts(fallback)) {
    throw new Error(
      `${model} returned no image twice (${describeEmptyResponse(second)}) ` +
        `then ${DEFAULT_MODEL} also returned none: ${describeEmptyResponse(fallback)}`
    );
  }

  return { response: fallback, fallbackFrom: model };
}

function generateWithRecovery(request: {
  model: string;
  contents: any;
  config: Record<string, unknown>;
}): Promise<{ response: any; fallbackFrom?: string }> {
  const client = getClient();
  return resolveWithRecovery(request.model, (model) =>
    client.models.generateContent({ ...request, model } as any)
  );
}

// ─── Image Generation (text-to-image) ───────────────────────────────────────

export async function generateImage(
  prompt: string,
  options: GenerateOptions = {}
): Promise<GenerateResult> {
  const model = options.model || DEFAULT_MODEL;
  const outputDir = ensureDir(options.outputDir || process.cwd());
  const filename = options.filename || generateFilename(prompt);

  const config: Record<string, unknown> = {
    responseModalities: ["TEXT", "IMAGE"],
  };

  const imageConfig: Record<string, string> = {};
  if (options.aspectRatio) imageConfig.aspectRatio = options.aspectRatio;
  if (options.resolution) imageConfig.imageSize = options.resolution;
  if (Object.keys(imageConfig).length > 0) {
    config.imageConfig = imageConfig;
  }

  const { response, fallbackFrom } = await generateWithRecovery({
    model,
    contents: prompt,
    config,
  });

  return { ...extractAndSaveImage(response, outputDir, filename), fallbackFrom };
}

// ─── Image Editing (image + text-to-image) ──────────────────────────────────

export async function editImage(
  imagePath: string,
  prompt: string,
  options: GenerateOptions = {}
): Promise<GenerateResult> {
  const model = options.model || DEFAULT_MODEL;

  // Resolve and validate source image
  const resolvedImagePath = path.resolve(imagePath);
  if (!fs.existsSync(resolvedImagePath)) {
    throw new Error(`Source image not found: ${resolvedImagePath}`);
  }

  const outputDir = ensureDir(
    options.outputDir || path.dirname(resolvedImagePath)
  );
  const filename =
    options.filename || generateFilename(prompt, "nanobanana_edit");

  // Read image as base64
  const imageData = fs.readFileSync(resolvedImagePath);
  const base64Image = imageData.toString("base64");
  const mimeType = getMimeType(resolvedImagePath);

  const config: Record<string, unknown> = {
    responseModalities: ["TEXT", "IMAGE"],
  };

  const imageConfig: Record<string, string> = {};
  if (options.aspectRatio) imageConfig.aspectRatio = options.aspectRatio;
  if (options.resolution) imageConfig.imageSize = options.resolution;
  if (Object.keys(imageConfig).length > 0) {
    config.imageConfig = imageConfig;
  }

  const contents = [
    { text: prompt },
    {
      inlineData: {
        mimeType,
        data: base64Image,
      },
    },
  ];

  const { response, fallbackFrom } = await generateWithRecovery({
    model,
    contents,
    config,
  });

  return { ...extractAndSaveImage(response, outputDir, filename), fallbackFrom };
}

// ─── Response Processing ────────────────────────────────────────────────────

export function extractAndSaveImage(
  response: any,
  outputDir: string,
  filename: string
): GenerateResult {
  let textResponse: string | undefined;
  let imageSaved = false;
  let filePath = "";

  if (!hasImageParts(response)) {
    throw new Error(describeEmptyResponse(response));
  }

  const parts = response.candidates[0].content.parts;

  for (const part of parts) {
    if (part.text) {
      textResponse = part.text;
    } else if (part.inlineData) {
      const imageData = part.inlineData.data;
      if (!imageData) continue;

      const buffer = Buffer.from(imageData, "base64");
      const correctedFilename = correctExtension(filename, part.inlineData.mimeType);
      filePath = path.join(outputDir, correctedFilename);
      fs.writeFileSync(filePath, buffer);
      imageSaved = true;
    }
  }

  if (!imageSaved) {
    throw new Error(
      "No image was generated. The model returned text only. " +
        (textResponse
          ? `Model response: ${textResponse}`
          : "Try rephrasing your prompt.")
    );
  }

  return { filePath, textResponse };
}

// ─── Utilities ──────────────────────────────────────────────────────────────

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    ".svg": "image/svg+xml",
  };
  return mimeTypes[ext] || "image/png";
}
