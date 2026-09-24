#!/usr/bin/env node
/**
 * Kitchen.co MCP server (stdio).
 * Env: KITCHEN_BASE_URL, KITCHEN_API_KEY
 * Optional: KITCHEN_WORKSPACE, KITCHEN_PROFILE_NAME
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  API_INDEX_TEXT,
  API_INDEX_URI,
  CAPABILITIES_URI,
  INVOICE_DEFAULTS_TEXT,
  INVOICE_DEFAULTS_URI,
} from "./hot-path";
import { createClientFromEnv } from "./kitchen-client";
import { CAPABILITIES, buildTools, SERVER_INSTRUCTIONS } from "./tools";

async function main() {
  const profile =
    process.env.KITCHEN_WORKSPACE?.trim() ||
    process.env.KITCHEN_PROFILE_NAME?.trim() ||
    process.env.KITCHEN_BASE_URL?.trim() ||
    "default";

  const client = createClientFromEnv();
  const tools = buildTools(client);

  const server = new McpServer(
    {
      name: `kitchen-co-mcp-unofficial:${profile}`,
      version: "0.7.4",
    },
    {
      instructions: SERVER_INSTRUCTIONS,
    }
  );

  server.registerResource(
    "kitchen-api-index",
    API_INDEX_URI,
    {
      description:
        "Compact public Kitchen path index for kitchen_request. Local to this MCP, not a live Kitchen dump. Read on demand instead of kitchen_capabilities.",
      mimeType: "text/plain",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/plain",
          text: API_INDEX_TEXT,
        },
      ],
    })
  );

  server.registerResource(
    "kitchen-capabilities",
    CAPABILITIES_URI,
    {
      description:
        "Full Kitchen MCP catalog (hot_path, request_index, permissions, invoice_defaults, gaps). Same payload as kitchen_capabilities. Local to this MCP.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(CAPABILITIES, null, 2),
        },
      ],
    })
  );

  server.registerResource(
    "kitchen-invoice-defaults",
    INVOICE_DEFAULTS_URI,
    {
      description:
        "Do not override Kitchen invoice Design & Details defaults (header, memo, footer_notes) unless the user explicitly asked. Local to this MCP.",
      mimeType: "text/plain",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/plain",
          text: INVOICE_DEFAULTS_TEXT,
        },
      ],
    })
  );

  // MCP SDK + Zod generics can exceed TS instantiation depth on large tool sets
  const register = server.registerTool.bind(server) as (
    name: string,
    config: { description: string; inputSchema: unknown },
    cb: (args: Record<string, unknown>) => Promise<unknown>
  ) => unknown;

  for (const tool of tools) {
    register(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema,
      },
      async (args) => tool.handler(args ?? {})
    );
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(
    err instanceof Error ? err.message : "Failed to start Kitchen.co MCP"
  );
  process.exit(1);
});
