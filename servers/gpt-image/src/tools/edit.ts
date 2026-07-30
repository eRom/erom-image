/**
 * gpt-image MCP Tool — gpt_image_edit
 * Image editing and multi-image composition via the OpenAI Images API.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  BACKGROUNDS,
  DEFAULT_MODEL,
  MODELS,
  OUTPUT_FORMATS,
  QUALITIES,
  validateSize,
} from "../constants.js";
import { editImage } from "../services/openai.js";

const EditInputSchema = z.object({
  image_paths: z
    .array(z.string())
    .min(1, "At least one input image is required")
    .max(16, "At most 16 input images are supported")
    .describe("Paths to the input images; reference them as Image 1, Image 2... in the prompt"),
  prompt: z
    .string()
    .min(1, "Prompt is required")
    .max(5000, "Prompt must not exceed 5000 characters")
    .describe("Editing instructions"),
  mask_path: z
    .string()
    .optional()
    .describe("Optional PNG mask with an alpha channel, matching the first image dimensions"),
  output_dir: z.string().optional().describe("Output directory (defaults to the first image directory)"),
  filename: z.string().optional().describe("Output filename (auto-generated if omitted)"),
  size: z.string().default("auto").describe("Output size; same rules as gpt_image_generate"),
  quality: z.enum(QUALITIES).default("auto").describe("Rendering quality"),
  output_format: z.enum(OUTPUT_FORMATS).default("png").describe("Encoding of the saved file"),
  output_compression: z
    .number()
    .int()
    .min(0)
    .max(100)
    .optional()
    .describe("Compression level 0-100, for jpeg and webp only"),
  background: z.enum(BACKGROUNDS).optional().describe("Background handling; gpt-image-2 has no transparent mode"),
  model: z.enum(MODELS).default(DEFAULT_MODEL).describe("OpenAI image model"),
});

type EditInput = z.infer<typeof EditInputSchema>;

export function registerEditTool(server: McpServer): void {
  server.registerTool(
    "gpt_image_edit",
    {
      title: "GPT Image — Edit or Compose Images",
      description: `Edit an existing image, or compose several images into one, using the
OpenAI Images API (gpt-image-2). Accepts 1 to 16 input images.

Use it for: high-fidelity retouching that must preserve identity and geometry,
compositing subjects or styles across images, and inpainting through a mask.

Prompting tips: reference inputs by index ("apply Image 2's style to Image 1's subject").
State what must not change: "change only X, keep everything else the same", and repeat
the preservation list on every iteration to prevent drift. gpt-image-2 always processes
inputs at high fidelity.`,
      inputSchema: EditInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: EditInput) => {
      try {
        const size = validateSize(params.size);

        const result = await editImage(params.image_paths, params.prompt, {
          model: params.model,
          size,
          quality: params.quality,
          outputFormat: params.output_format,
          outputCompression: params.output_compression,
          background: params.background,
          maskPath: params.mask_path,
          outputDir: params.output_dir,
          filename: params.filename,
        });

        const lines = [
          `✅ Image edited successfully!`,
          `📁 Saved to: ${result.filePath}`,
          `🖼️ Inputs: ${params.image_paths.length}`,
          `📐 Size: ${size}`,
          `✨ Quality: ${params.quality}`,
          `🤖 Model: ${params.model}`,
        ];
        if (params.mask_path) {
          lines.push(`🎭 Mask: ${params.mask_path}`);
        }
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
              text: `Error editing image: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );
}
