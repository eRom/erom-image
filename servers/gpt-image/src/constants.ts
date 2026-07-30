/**
 * gpt-image MCP Server — Constants
 * Models, size presets and geometric constraints of the OpenAI Images API.
 */

// ─── Models ──────────────────────────────────────────────────────────────────
// gpt-image-2 only: chatgpt-image-latest, gpt-image-1.5 and gpt-image-1-mini were
// deprecated on 2026-06-02 and are removed from the API on 2026-12-01.
export const DEFAULT_MODEL = "gpt-image-2";

export const MODELS = ["gpt-image-2", "gpt-image-2-2026-04-21"] as const;
export type Model = (typeof MODELS)[number];

// ─── Sizes ───────────────────────────────────────────────────────────────────
export const SIZE_PRESETS = [
  "auto",
  "1024x1024",
  "1536x1024",
  "1024x1536",
  "2048x2048",
] as const;

// gpt-image-2 constraints: edges multiple of 16 and up to 3840, long:short ratio
// up to 3:1, total pixels between 655_360 and 8_294_400 (3840x2160 hits the cap).
const MAX_EDGE = 3840;
const EDGE_MULTIPLE = 16;
const MAX_RATIO = 3;
const MIN_PIXELS = 655_360;
const MAX_PIXELS = 8_294_400;

/** Returns the size unchanged when valid, throws with an actionable message otherwise. */
export function validateSize(size: string): string {
  if ((SIZE_PRESETS as readonly string[]).includes(size)) return size;

  const match = /^(\d+)x(\d+)$/.exec(size);
  if (!match) {
    throw new Error(
      `Invalid size "${size}". Use a preset (${SIZE_PRESETS.join(", ")}) or custom "WIDTHxHEIGHT" (e.g. 2560x1440).`
    );
  }

  const width = Number(match[1]);
  const height = Number(match[2]);

  if (width % EDGE_MULTIPLE !== 0 || height % EDGE_MULTIPLE !== 0) {
    throw new Error(`Invalid size "${size}": both edges must be multiples of ${EDGE_MULTIPLE}.`);
  }
  if (width > MAX_EDGE || height > MAX_EDGE) {
    throw new Error(`Invalid size "${size}": each edge must not exceed ${MAX_EDGE}px.`);
  }

  const ratio = Math.max(width, height) / Math.min(width, height);
  if (ratio > MAX_RATIO) {
    throw new Error(
      `Invalid size "${size}": aspect ratio must not exceed ${MAX_RATIO}:1 (got ${ratio.toFixed(2)}:1).`
    );
  }

  const pixels = width * height;
  if (pixels < MIN_PIXELS || pixels > MAX_PIXELS) {
    throw new Error(
      `Invalid size "${size}": total pixels must be between ${MIN_PIXELS} and ${MAX_PIXELS} (got ${pixels}).`
    );
  }

  return size;
}

// ─── Enums ───────────────────────────────────────────────────────────────────
export const QUALITIES = ["auto", "low", "medium", "high"] as const;
export const OUTPUT_FORMATS = ["png", "jpeg", "webp"] as const;
// "transparent" is intentionally absent: the API documentation states that
// gpt-image-2 requests using background:"transparent" fail.
export const BACKGROUNDS = ["auto", "opaque"] as const;
export const MODERATIONS = ["auto", "low"] as const;

export type Quality = (typeof QUALITIES)[number];
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];
export type Background = (typeof BACKGROUNDS)[number];
export type Moderation = (typeof MODERATIONS)[number];
