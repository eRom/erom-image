/**
 * Nano Banana MCP Tool — nanobanana_diagram
 * Technical diagram generation with specialized prompt engineering.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
    ASPECT_RATIOS,
    COMPLEXITY_LEVELS,
    DEFAULT_MODEL,
    DIAGRAM_STYLES,
    DIAGRAM_TYPES,
    RESOLUTIONS,
} from "../constants.js";
import { generateImage } from "../services/gemini.js";

const DiagramInputSchema = z.object({
  prompt: z
    .string()
    .min(1, "Prompt is required")
    .max(5000, "Prompt must not exceed 5000 characters")
    .describe("Description of the diagram to generate (e.g., 'user login process', 'microservices architecture')"),
  output_dir: z
    .string()
    .default("./")
    .describe("Output directory for the generated diagram"),
  filename: z
    .string()
    .optional()
    .describe("Output filename (auto-generated if omitted)"),
  type: z
    .enum(DIAGRAM_TYPES)
    .default("flowchart")
    .describe("Diagram type: flowchart, architecture, database, sequence, mindmap"),
  style: z
    .enum(DIAGRAM_STYLES)
    .default("professional")
    .describe("Visual style: professional, minimal, colorful, blueprint"),
  complexity: z
    .enum(COMPLEXITY_LEVELS)
    .default("standard")
    .describe("Detail level: simple, standard, detailed"),
  aspect_ratio: z
    .enum(ASPECT_RATIOS)
    .default("16:9")
    .describe("Image aspect ratio"),
  resolution: z
    .enum(RESOLUTIONS)
    .default("2K")
    .describe("Image resolution"),
  model: z
    .enum(["gemini-3.1-flash-image-preview", "gemini-3-pro-image-preview"])
    .default(DEFAULT_MODEL)
    .describe("Nano Banana model to use"),
});

type DiagramInput = z.infer<typeof DiagramInputSchema>;

// ─── Diagram Prompt Engineering ─────────────────────────────────────────────

function buildDiagramPrompt(params: DiagramInput): string {
  const typeGuidelines: Record<string, string> = {
    flowchart:
      "Create a clear flowchart diagram with properly connected nodes, decision diamonds, and directional arrows. Use standard flowchart symbols: rectangles for processes, diamonds for decisions, ovals for start/end.",
    architecture:
      "Create a system architecture diagram showing components, services, and their connections. Use boxes for services/components, arrows for data flow, and clear labels. Show layers and boundaries.",
    database:
      "Create a database schema diagram (ER diagram) showing tables, fields, primary keys, and relationships. Use standard ER notation with cardinality markers (1:1, 1:N, M:N).",
    sequence:
      "Create a sequence diagram showing interactions between actors/systems over time. Use vertical lifelines, horizontal arrows for messages, and proper sequencing notation.",
    mindmap:
      "Create a mind map diagram with a central concept branching out to related ideas. Use organic, radial layout with hierarchical branches. Color-code different branches.",
  };

  const styleGuidelines: Record<string, string> = {
    professional:
      "Use a clean, professional design with muted colors (blues, grays), consistent spacing, sharp edges, and corporate-appropriate styling. White or light gray background.",
    minimal:
      "Use a minimal design with thin lines, plenty of white space, limited colors (2-3 max), and simple geometric shapes. Ultra-clean and modern.",
    colorful:
      "Use a vibrant, colorful design with distinct colors for different elements, gradients, and modern styling. Visually engaging while remaining readable.",
    blueprint:
      "Use a blueprint/technical drawing style with a dark blue background, white/cyan lines, grid pattern, and mono-space text. Engineering aesthetic.",
  };

  const complexityGuidelines: Record<string, string> = {
    simple:
      "Keep it simple with 3-6 main elements. Focus on the high-level overview without details.",
    standard:
      "Include moderate detail with 6-12 elements. Show the main components and their key relationships.",
    detailed:
      "Create a comprehensive diagram with 12+ elements. Include sub-components, detailed labels, annotations, and legends.",
  };

  return [
    `Create a technical ${params.type} diagram: ${params.prompt}.`,
    typeGuidelines[params.type] || "",
    styleGuidelines[params.style] || "",
    complexityGuidelines[params.complexity] || "",
    "All text must be clearly readable. Use consistent font sizes.",
    "Include a title at the top of the diagram.",
    "Ensure proper alignment and spacing between elements.",
  ].join(" ");
}

export function registerDiagramTool(server: McpServer): void {
  server.registerTool(
    "nanobanana_diagram",
    {
      title: "Nano Banana — Generate Diagram",
      description: `Generate professional technical diagrams from text descriptions.

Creates publication-ready diagrams with specialized prompt engineering for each type:
- flowchart: Process flows with decisions, actions, and connections
- architecture: System/software architecture with components and data flow
- database: ER diagrams with tables, fields, and relationships
- sequence: Interaction diagrams between actors/systems over time
- mindmap: Hierarchical concept maps with branching ideas

Available styles: professional, minimal, colorful, blueprint
Complexity levels: simple (3-6 elements), standard (6-12), detailed (12+)

Example usage:
- prompt: "user authentication flow with OAuth2", type: "flowchart"
- prompt: "microservices e-commerce platform", type: "architecture", complexity: "detailed"
- prompt: "social media database schema", type: "database", style: "blueprint"`,
      inputSchema: DiagramInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: DiagramInput) => {
      try {
        const diagramPrompt = buildDiagramPrompt(params);

        const result = await generateImage(diagramPrompt, {
          model: params.model,
          aspectRatio: params.aspect_ratio,
          resolution: params.resolution,
          outputDir: params.output_dir,
          filename: params.filename,
        });

        const lines = [
          `✅ Diagram generated successfully!`,
          `📁 Saved to: ${result.filePath}`,
          `📊 Type: ${params.type}`,
          `🎨 Style: ${params.style}`,
          `📏 Complexity: ${params.complexity}`,
          `🖼️ Aspect ratio: ${params.aspect_ratio}`,
          `📐 Resolution: ${params.resolution}`,
          `🍌 Model: ${params.model}`,
        ];

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
              text: `Error generating diagram: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );
}
