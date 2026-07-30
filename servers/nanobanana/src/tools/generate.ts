/**
 * Nano Banana MCP Tool — nanobanana_generate
 * Text-to-image generation with advanced options.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
    ASPECT_RATIOS,
    DEFAULT_MODEL,
    RESOLUTIONS
} from "../constants.js";
import { generateImage } from "../services/gemini.js";

const GenerateInputSchema = z.object({
  prompt: z
    .string()
    .min(1, "Prompt is required")
    .max(5000, "Prompt must not exceed 5000 characters")
    .describe("Description of the image to generate"),
  output_dir: z
    .string()
    .default("./")
    .describe("Output directory for the generated image"),
  filename: z
    .string()
    .optional()
    .describe("Output filename (auto-generated if omitted)"),
  aspect_ratio: z
    .enum(ASPECT_RATIOS)
    .default("1:1")
    .describe("Image aspect ratio"),
  resolution: z
    .enum(RESOLUTIONS)
    .default("1K")
    .describe("Image resolution: 512px, 1K, 2K, or 4K"),
  model: z
    .enum(["gemini-3.1-flash-image-preview", "gemini-3-pro-image-preview"])
    .default(DEFAULT_MODEL)
    .describe("Nano Banana model to use"),
  style: z
    .string()
    .optional()
    .describe(
      "Optional style to apply (e.g., watercolor, oil-painting, pixel-art, anime, photorealistic, pencil-sketch)"
    ),
});

type GenerateInput = z.infer<typeof GenerateInputSchema>;

export function registerGenerateTool(server: McpServer): void {
  server.registerTool(
    "nanobanana_generate",
    {
      title: "Nano Banana — Generate Image",
      description: `Generate an image from a text prompt using Nano Banana (Gemini image models).

Supports advanced options: aspect ratio, resolution, style, and model selection.
The generated image is saved as PNG to the specified output directory.

Available aspect ratios: 1:1, 1:4, 1:8, 2:3, 3:2, 3:4, 4:1, 4:3, 4:5, 5:4, 8:1, 9:16, 16:9, 21:9
Available resolutions: 512px, 1K, 2K, 4K
Available models: gemini-3.1-flash-image-preview (Nano Banana 2, default), gemini-3-pro-image-preview (Nano Banana Pro)

Example prompts:
- "A watercolor painting of a fox in a snowy forest"
- "A professional product photo of a coffee cup on a marble table"
- "An isometric 3D cartoon scene of Tokyo with cherry blossoms"`,
      inputSchema: GenerateInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: GenerateInput) => {
      try {
        // Build the effective prompt with style
        let effectivePrompt = params.prompt;
        if (params.style) {
          effectivePrompt = `${params.prompt}. Style: ${params.style}.`;
        }

        const result = await generateImage(effectivePrompt, {
          model: params.model,
          aspectRatio: params.aspect_ratio,
          resolution: params.resolution,
          outputDir: params.output_dir,
          filename: params.filename,
        });

        const lines = [
          `✅ Image generated successfully!`,
          `📁 Saved to: ${result.filePath}`,
          `🖼️ Aspect ratio: ${params.aspect_ratio}`,
          `📐 Resolution: ${params.resolution}`,
          `🍌 Model: ${params.model}`,
        ];

        if (params.style) {
          lines.push(`🎨 Style: ${params.style}`);
        }
        if (result.textResponse) {
          lines.push(`\n💬 Model notes: ${result.textResponse}`);
        }

        return {
          content: [{ type: "text", text: lines.join("\n") }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error generating image: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );
}
