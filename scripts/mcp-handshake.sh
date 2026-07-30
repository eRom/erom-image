#!/usr/bin/env bash
# List the tools exposed by a stdio MCP server, through a minimal JSON-RPC handshake.
# Usage: scripts/mcp-handshake.sh <path/to/bundle.js>
# Environment variables (API keys) are inherited from the caller.
set -euo pipefail

BUNDLE="${1:?usage: mcp-handshake.sh <bundle.js>}"

printf '%s\n%s\n%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"handshake","version":"1.0"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
  | node "$BUNDLE" 2>/dev/null \
  | jq -r 'select(.id == 2) | .result.tools[] | "\(.name)\t[\(.inputSchema.properties | keys | join(", "))]"'
