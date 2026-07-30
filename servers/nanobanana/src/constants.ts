/**
 * Nano Banana MCP Server — Constants
 * Models, aspect ratios, resolutions, and style presets.
 */

// ─── Models ──────────────────────────────────────────────────────────────────
export const DEFAULT_MODEL = "gemini-3.1-flash-image-preview";

export const MODELS = {
  "nano-banana-2": "gemini-3.1-flash-image-preview",
  "nano-banana-pro": "gemini-3-pro-image-preview",
} as const;

export type ModelKey = keyof typeof MODELS;
export type ModelId = (typeof MODELS)[ModelKey];

// ─── Aspect Ratios ───────────────────────────────────────────────────────────
export const ASPECT_RATIOS = [
  "1:1", "1:4", "1:8",
  "2:3", "3:2", "3:4",
  "4:1", "4:3", "4:5",
  "5:4", "8:1", "9:16",
  "16:9", "21:9",
] as const;

export type AspectRatio = (typeof ASPECT_RATIOS)[number];

// ─── Resolutions ─────────────────────────────────────────────────────────────
export const RESOLUTIONS = ["512px", "1K", "2K", "4K"] as const;
export type Resolution = (typeof RESOLUTIONS)[number];

// ─── Diagram Types ───────────────────────────────────────────────────────────
export const DIAGRAM_TYPES = [
  "flowchart",
  "architecture",
  "database",
  "sequence",
  "mindmap",
] as const;

export type DiagramType = (typeof DIAGRAM_TYPES)[number];

// ─── Diagram Styles ──────────────────────────────────────────────────────────
export const DIAGRAM_STYLES = [
  "professional",
  "minimal",
  "colorful",
  "blueprint",
] as const;

export type DiagramStyle = (typeof DIAGRAM_STYLES)[number];

// ─── Complexity Levels ───────────────────────────────────────────────────────
export const COMPLEXITY_LEVELS = ["simple", "standard", "detailed"] as const;
export type ComplexityLevel = (typeof COMPLEXITY_LEVELS)[number];

// ─── Icon Types ──────────────────────────────────────────────────────────────
export const ICON_TYPES = ["app-icon", "favicon", "ui-element"] as const;
export type IconType = (typeof ICON_TYPES)[number];

// ─── Icon Styles ─────────────────────────────────────────────────────────────
export const ICON_STYLES = [
  "minimal",
  "flat",
  "3d",
  "outline",
  "gradient",
  "glassmorphism",
] as const;

export type IconStyle = (typeof ICON_STYLES)[number];
