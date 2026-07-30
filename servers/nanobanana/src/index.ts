#!/usr/bin/env node
/**
 * Nano Banana MCP Server
 *
 * A custom MCP server for image generation via Gemini API (Nano Banana 2).
 * Provides 4 tools: generate, edit, icon, diagram.
 *
 * Transport: stdio (local integration with Opencode/Antigravity)
 * Model: gemini-3.1-flash-image-preview (Nano Banana 2) by default
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerDiagramTool } from "./tools/diagram.js";
import { registerEditTool } from "./tools/edit.js";
import { registerGenerateTool } from "./tools/generate.js";
import { registerIconTool } from "./tools/icon.js";

// ─── Server Initialization ──────────────────────────────────────────────────

const server = new McpServer({
  name: "nanobanana-mcp-server",
  version: "1.0.0",
});

// ─── Register Tools ─────────────────────────────────────────────────────────

registerGenerateTool(server);
registerEditTool(server);
registerIconTool(server);
registerDiagramTool(server);

// ─── Run Server ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error(
      "ERROR: GEMINI_API_KEY or GOOGLE_API_KEY environment variable is required."
    );
    console.error(
      "Set it with: export GEMINI_API_KEY=your_key"
    );
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("🍌 Nano Banana MCP Server running via stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
