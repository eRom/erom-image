/**
 * gpt-image MCP Tool — gpt_image_generate
 * Text-to-image generation via the OpenAI Images API.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  BACKGROUNDS,
  DEFAULT_MODEL,
  MODELS,
  MODERATIONS,
  OUTPUT_FORMATS,
  QUALITIES,
  validateSize,
} from "../constants.js";
import { generateImage } from "../services/openai.js";

const GenerateInputSchema = z.object({
  prompt: z
    .string()
    .min(1, "Prompt is required")
    .max(5000, "Prompt must not exceed 5000 characters")
    .describe("Description of the image to generate"),
  output_dir: z.string().default("./").describe("Output directory for the generated image"),
  filename: z.string().optional().describe("Output filename (auto-generated if omitted)"),
  size: z
    .string()
    .default("auto")
    .describe(
      'Image size: auto, 1024x1024, 1536x1024, 1024x1536, 2048x2048, or a custom "WIDTHxHEIGHT" (edges multiple of 16, up to 3840, ratio up to 3:1)'
    ),
  quality: z.enum(QUALITIES).default("auto").describe("Rendering quality; use medium or high for dense text"),
  output_format: z.enum(OUTPUT_FORMATS).default("png").describe("Encoding of the saved file"),
  output_compression: z
    .number()
    .int()
    .min(0)
    .max(100)
    .optional()
    .describe("Compression level 0-100, for jpeg and webp only"),
  background: z.enum(BACKGROUNDS).optional().describe("Background handling; gpt-image-2 has no transparent mode"),
  moderation: z.enum(MODERATIONS).optional().describe("Moderation strictness"),
  model: z.enum(MODELS).default(DEFAULT_MODEL).describe("OpenAI image model"),
});

type GenerateInput = z.infer<typeof GenerateInputSchema>;

export function registerGenerateTool(server: McpServer): void {
  server.registerTool(
    "gpt_image_generate",
    {
      title: "GPT Image — Generate Image",
      description: `Generate an image from a text prompt using the OpenAI Images API (gpt-image-2).

Strengths over other image models: accurate text rendering inside the image, UI mockups,
posters and typographic layouts, and instruction following on precise constraints.

Sizes: auto, 1024x1024, 1536x1024, 1024x1536, 2048x2048, or custom "WIDTHxHEIGHT"
(edges multiple of 16 and up to 3840, ratio up to 3:1, 2560x1440 is the recommended
reliability ceiling).
Quality: low (drafts, cheapest), medium, high (dense text, small type), auto.
Note: gpt-image-2 does not support transparent backgrounds.

Prompting tips: order the prompt background/scene -> subject -> key details -> constraints.
Put exact copy in quotes and specify typography (font style, size, colour, placement).`,
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
        const size = validateSize(params.size);

        const result = await generateImage(params.prompt, {
          model: params.model,
          size,
          quality: params.quality,
          outputFormat: params.output_format,
          outputCompression: params.output_compression,
          background: params.background,
          moderation: params.moderation,
          outputDir: params.output_dir,
          filename: params.filename,
        });

        const lines = [
          `✅ Image generated successfully!`,
          `📁 Saved to: ${result.filePath}`,
          `📐 Size: ${size}`,
          `✨ Quality: ${params.quality}`,
          `🤖 Model: ${params.model}`,
        ];
        if (result.usage?.total_tokens) {
          lines.push(`🧮 Tokens: ${result.usage.total_tokens}`);
        }

        return { content: [{ type: "text", text: lines.join("\n") }] };
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
