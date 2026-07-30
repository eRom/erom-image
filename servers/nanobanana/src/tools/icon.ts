/**
 * Nano Banana MCP Tool — nanobanana_icon
 * App icon, favicon, and UI element generation with specialized prompt engineering.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
    DEFAULT_MODEL,
    ICON_STYLES,
    ICON_TYPES,
} from "../constants.js";
import { generateImage } from "../services/gemini.js";

const IconInputSchema = z.object({
  prompt: z
    .string()
    .min(1, "Prompt is required")
    .max(2000, "Prompt must not exceed 2000 characters")
    .describe("Description of the icon to generate (e.g., 'coffee cup logo', 'settings gear')"),
  output_dir: z
    .string()
    .default("./")
    .describe("Output directory for generated icons"),
  type: z
    .enum(ICON_TYPES)
    .default("app-icon")
    .describe("Type of icon: app-icon, favicon, or ui-element"),
  sizes: z
    .array(z.number().int().min(8).max(1024))
    .default([64, 128, 256])
    .describe("Array of sizes in pixels to generate (e.g., [16, 32, 64, 128, 256])"),
  style: z
    .enum(ICON_STYLES)
    .default("minimal")
    .describe("Visual style: minimal, flat, 3d, outline, gradient, glassmorphism"),
  model: z
    .enum(["gemini-3.1-flash-image-preview", "gemini-3-pro-image-preview"])
    .default(DEFAULT_MODEL)
    .describe("Nano Banana model to use"),
});

type IconInput = z.infer<typeof IconInputSchema>;

// ─── Icon Prompt Engineering ─────────────────────────────────────────────────

function buildIconPrompt(params: IconInput): string {
  const typeGuidelines: Record<string, string> = {
    "app-icon":
      "Design an app icon suitable for iOS and Android. The icon should be on a solid or gradient background, with rounded corners implied. It must be instantly recognizable at small sizes.",
    favicon:
      "Design a small, simple favicon. The design must be extremely clear and recognizable at 16x16 pixels. Use bold shapes and high contrast. Avoid fine details.",
    "ui-element":
      "Design a UI element/icon for a modern application interface. The design should be clean, scalable, and work well on both light and dark backgrounds.",
  };

  const styleGuidelines: Record<string, string> = {
    minimal: "Use a minimalist style with clean lines, simple shapes, and limited colors.",
    flat: "Use flat design with solid colors, no shadows or gradients, bold and modern.",
    "3d": "Use a colorful and tactile 3D style with soft shadows and subtle depth.",
    outline: "Use line-art/outline style with consistent stroke width, clean and professional.",
    gradient: "Use rich gradients with modern color transitions, vibrant and eye-catching.",
    glassmorphism: "Use glassmorphism style with frosted glass effect, transparency, and subtle blur.",
  };

  return [
    params.prompt,
    typeGuidelines[params.type] || "",
    styleGuidelines[params.style] || "",
    "No text in the icon.",
    "The background should be clean and simple.",
    "The icon must be perfectly centered.",
    "Square format, suitable for app icons.",
  ].join(" ");
}

export function registerIconTool(server: McpServer): void {
  server.registerTool(
    "nanobanana_icon",
    {
      title: "Nano Banana — Generate Icon",
      description: `Generate app icons, favicons, and UI elements with specialized prompt engineering.

Creates icons with proper formatting for each type:
- app-icon: iOS/Android app icons with clean backgrounds
- favicon: Ultra-simple designs optimized for 16-32px
- ui-element: Interface icons for modern applications

Each icon is generated at multiple sizes (default: 64, 128, 256px).
Specialized prompts ensure consistent, professional results.

Available styles: minimal, flat, 3d, outline, gradient, glassmorphism

Example usage:
- prompt: "coffee cup logo", type: "app-icon", sizes: [128, 256, 512]
- prompt: "lightning bolt", type: "favicon", sizes: [16, 32, 64]
- prompt: "settings gear", type: "ui-element", style: "outline"`,
      inputSchema: IconInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: IconInput) => {
      try {
        const iconPrompt = buildIconPrompt(params);
        const generatedFiles: string[] = [];

        // Generate one high-quality icon (the model generates best at higher res)
        // We generate at the largest requested size
        const maxSize = Math.max(...params.sizes);
        const resolution = maxSize >= 512 ? "1K" : "512px";

        const slug = params.prompt
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, "")
          .trim()
          .split(/\s+/)
          .slice(0, 3)
          .join("_");

        const timestamp = Date.now();

        // Generate icons for each size
        for (const size of params.sizes) {
          const sizePrompt = `${iconPrompt} The icon should be designed for ${size}x${size} pixels.`;
          const filename = `icon_${slug}_${size}px_${timestamp}.png`;

          const result = await generateImage(sizePrompt, {
            model: params.model,
            aspectRatio: "1:1",
            resolution,
            outputDir: params.output_dir,
            filename,
          });

          generatedFiles.push(result.filePath);
        }

        const lines = [
          `✅ Icons generated successfully!`,
          `📁 Output directory: ${params.output_dir}`,
          `🎯 Type: ${params.type}`,
          `🎨 Style: ${params.style}`,
          `📐 Sizes: ${params.sizes.map((s) => `${s}px`).join(", ")}`,
          `🍌 Model: ${params.model}`,
          ``,
          `Generated files:`,
          ...generatedFiles.map((f) => `  • ${f}`),
        ];

        return {
          content: [{ type: "text", text: lines.join("\n") }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error generating icons: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );
}
