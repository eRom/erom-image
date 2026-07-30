/**
 * Nano Banana MCP Tool — nanobanana_edit
 * Image editing with natural language instructions.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
    ASPECT_RATIOS,
    DEFAULT_MODEL,
    RESOLUTIONS,
} from "../constants.js";
import { editImage } from "../services/gemini.js";

const EditInputSchema = z.object({
  image_path: z
    .string()
    .min(1, "Image path is required")
    .describe("Absolute or relative path to the source image to edit"),
  prompt: z
    .string()
    .min(1, "Edit instructions are required")
    .max(5000, "Prompt must not exceed 5000 characters")
    .describe("Natural language instructions for how to edit the image"),
  output_dir: z
    .string()
    .optional()
    .describe("Output directory (defaults to same directory as source image)"),
  filename: z
    .string()
    .optional()
    .describe("Output filename (auto-generated if omitted)"),
  aspect_ratio: z
    .enum(ASPECT_RATIOS)
    .optional()
    .describe("Output aspect ratio (preserves original if omitted)"),
  resolution: z
    .enum(RESOLUTIONS)
    .default("1K")
    .describe("Output resolution"),
  model: z
    .enum(["gemini-3.1-flash-image-preview", "gemini-3-pro-image-preview"])
    .default(DEFAULT_MODEL)
    .describe("Nano Banana model to use"),
});

type EditInput = z.infer<typeof EditInputSchema>;

export function registerEditTool(server: McpServer): void {
  server.registerTool(
    "nanobanana_edit",
    {
      title: "Nano Banana — Edit Image",
      description: `Edit an existing image using natural language instructions.

Provide the path to a source image and describe the changes you want.
The edited image is saved as a new PNG file.

Capabilities:
- Add, remove, or modify elements
- Change backgrounds, colors, or lighting
- Apply style transfers
- Restore or enhance old photos
- Remove unwanted elements

Example usage:
- image_path: "photo.jpg", prompt: "Add sunglasses to the person"
- image_path: "landscape.png", prompt: "Change to a sunset sky with warm colors"
- image_path: "old_photo.jpg", prompt: "Remove scratches, enhance clarity, restore colors"`,
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
        const result = await editImage(params.image_path, params.prompt, {
          model: params.model,
          aspectRatio: params.aspect_ratio,
          resolution: params.resolution,
          outputDir: params.output_dir,
          filename: params.filename,
        });

        const lines = [
          `✅ Image edited successfully!`,
          `📁 Saved to: ${result.filePath}`,
          `📷 Source: ${params.image_path}`,
          `📐 Resolution: ${params.resolution}`,
          `🍌 Model: ${params.model}`,
        ];

        if (params.aspect_ratio) {
          lines.push(`🖼️ Aspect ratio: ${params.aspect_ratio}`);
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
              text: `Error editing image: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );
}
