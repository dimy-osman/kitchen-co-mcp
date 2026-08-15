#!/usr/bin/env node
/**
 * Kitchen.co MCP server (stdio).
 * Env: KITCHEN_BASE_URL, KITCHEN_API_KEY
 * Optional: KITCHEN_PROFILE_NAME
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createClientFromEnv } from "./kitchen-client";
import { buildTools, SERVER_INSTRUCTIONS } from "./tools";

async function main() {
  const profile =
    process.env.KITCHEN_PROFILE_NAME?.trim() ||
    process.env.KITCHEN_BASE_URL?.trim() ||
    "default";

  const client = createClientFromEnv();
  const tools = buildTools(client);

  const server = new McpServer(
    {
      name: `kitchen-co-mcp-unofficial:${profile}`,
      version: "0.5.0",
    },
    {
      instructions: SERVER_INSTRUCTIONS,
    }
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
