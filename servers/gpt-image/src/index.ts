#!/usr/bin/env node
/**
 * gpt-image MCP Server
 *
 * MCP server for image generation and editing via the OpenAI Images API.
 * Provides 2 tools: generate, edit.
 *
 * Transport: stdio
 * Model: gpt-image-2 by default
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerEditTool } from "./tools/edit.js";
import { registerGenerateTool } from "./tools/generate.js";

// ─── Server Initialization ──────────────────────────────────────────────────

const server = new McpServer({
  name: "gpt-image-mcp-server",
  version: "1.0.0",
});

// ─── Register Tools ─────────────────────────────────────────────────────────

registerGenerateTool(server);
registerEditTool(server);

// ─── Run Server ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (!process.env.OPENAI_API_KEY) {
    console.error("ERROR: OPENAI_API_KEY environment variable is required.");
    console.error("Set it with: export OPENAI_API_KEY=<your key>");
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("🎨 GPT Image MCP Server running via stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
