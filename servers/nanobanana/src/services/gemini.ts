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

function ensureDir(dirPath: string): string {
  const resolved = path.resolve(dirPath);
  if (!fs.existsSync(resolved)) {
    fs.mkdirSync(resolved, { recursive: true });
  }
  return resolved;
}

// ─── Image Generation (text-to-image) ───────────────────────────────────────

export async function generateImage(
  prompt: string,
  options: GenerateOptions = {}
): Promise<GenerateResult> {
  const client = getClient();
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

  const response = await client.models.generateContent({
    model,
    contents: prompt,
    config,
  });

  return extractAndSaveImage(response, outputDir, filename);
}

// ─── Image Editing (image + text-to-image) ──────────────────────────────────

export async function editImage(
  imagePath: string,
  prompt: string,
  options: GenerateOptions = {}
): Promise<GenerateResult> {
  const client = getClient();
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

  const response = await client.models.generateContent({
    model,
    contents,
    config,
  });

  return extractAndSaveImage(response, outputDir, filename);
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

  const parts = response?.candidates?.[0]?.content?.parts;
  if (!parts || parts.length === 0) {
    throw new Error(
      "No content in API response. The model may have blocked the request due to safety filters."
    );
  }

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
