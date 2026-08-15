import { z } from "zod";
import { KitchenClient } from "./kitchen-client";

export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

export function ok(data: unknown): ToolResult {
  return {
    content: [
      {
        type: "text",
        text: typeof data === "string" ? data : JSON.stringify(data, null, 2),
      },
    ],
  };
}

export function fail(err: unknown): ToolResult {
  const message = err instanceof Error ? err.message : String(err);
  const body =
    err && typeof err === "object" && "body" in err
      ? String((err as { body: unknown }).body)
      : undefined;
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: body ? `${message}\n\n${body}` : message,
      },
    ],
  };
}

export const pageQuery = {
  page: z.number().int().positive().optional().describe("Page number"),
  per_page: z
    .number()
    .int()
    .positive()
    .max(100)
    .optional()
    .describe("Results per page (max 100)"),
};

export const visibility = z
  .enum(["private", "internal", "shared"])
  .describe("Access: private (owner), internal (team), shared (clients too)");

export const extraBody = z
  .record(z.unknown())
  .optional()
  .describe("Any extra Kitchen API fields not listed above");

export function mergeBody(
  named: Record<string, unknown>,
  extra?: unknown
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(named)) {
    if (v !== undefined) out[k] = v;
  }
  if (extra && typeof extra === "object" && !Array.isArray(extra)) {
    Object.assign(out, extra as Record<string, unknown>);
  }
  return out;
}

export type RegisteredTool = {
  name: string;
  description: string;
  inputSchema: z.ZodObject<z.ZodRawShape>;
  handler: (args: Record<string, unknown>) => Promise<ToolResult>;
};

export function run(
  fn: (args: Record<string, unknown>) => Promise<unknown>
): (args: Record<string, unknown>) => Promise<ToolResult> {
  return async (args) => {
    try {
      return ok(await fn(args));
    } catch (err) {
      return fail(err);
    }
  };
}

export function tool(
  name: string,
  description: string,
  inputSchema: z.ZodObject<z.ZodRawShape>,
  fn: (args: Record<string, unknown>, client: KitchenClient) => Promise<unknown>,
  client: KitchenClient
): RegisteredTool {
  return {
    name,
    description,
    inputSchema,
    handler: run((args) => fn(args, client)),
  };
}
