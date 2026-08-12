import { z } from "zod";
import { KitchenClient } from "./kitchen-client";

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

function ok(data: unknown): ToolResult {
  return {
    content: [
      {
        type: "text",
        text: typeof data === "string" ? data : JSON.stringify(data, null, 2),
      },
    ],
  };
}

function fail(err: unknown): ToolResult {
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

const pageQuery = {
  page: z.number().int().positive().optional().describe("Page number"),
  per_page: z
    .number()
    .int()
    .positive()
    .max(100)
    .optional()
    .describe("Results per page (max 100)"),
};

export type RegisteredTool = {
  name: string;
  description: string;
  inputSchema: z.ZodObject<z.ZodRawShape>;
  handler: (args: Record<string, unknown>) => Promise<ToolResult>;
};

export function buildTools(client: KitchenClient): RegisteredTool[] {
  return [
    {
      name: "kitchen_whoami",
      description:
        "Verify Kitchen API credentials and return connection metadata (base URL host only; never returns the API key).",
      inputSchema: z.object({}),
      handler: async () => {
        try {
          // Users/me style endpoints vary; try a lightweight authenticated call
          let data: unknown;
          try {
            data = await client.get("/users/me");
          } catch {
            data = await client.get("/members/me");
          }
          return ok({
            ok: true,
            apiHost: new URL(client.baseUrl).host,
            user: data,
          });
        } catch (err) {
          // Fall back: list templates is a common authenticated read
          try {
            const templates = await client.get("/templates", {
              page: 1,
              per_page: 1,
            });
            return ok({
              ok: true,
              apiHost: new URL(client.baseUrl).host,
              note: "Authenticated via /templates probe",
              sample: templates,
            });
          } catch (err2) {
            return fail(err2 instanceof Error ? err2 : err);
          }
        }
      },
    },
    {
      name: "kitchen_request",
      description:
        "Low-level Kitchen API request. Path is relative to /api (e.g. /tasks, /boards/abc). Prefer specific tools when available.",
      inputSchema: z.object({
        method: z
          .enum(["GET", "POST", "PUT", "PATCH", "DELETE"])
          .default("GET")
          .describe("HTTP method"),
        path: z
          .string()
          .describe("API path under /api, e.g. /tasks or /conversations/{id}"),
        query: z
          .record(z.union([z.string(), z.number(), z.boolean()]))
          .optional()
          .describe("Query string parameters"),
        body: z.unknown().optional().describe("JSON body for write methods"),
      }),
      handler: async (args) => {
        try {
          const method = String(args.method ?? "GET").toUpperCase();
          const path = String(args.path);
          const data = await client.request(method, path, {
            query: args.query as Record<
              string,
              string | number | boolean | undefined
            >,
            body: args.body,
          });
          return ok(data);
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_list_tasks",
      description: "List Kitchen tasks (paginated).",
      inputSchema: z.object({
        ...pageQuery,
        search: z.string().optional().describe("Optional search/filter text"),
      }),
      handler: async (args) => {
        try {
          return ok(
            await client.get("/tasks", {
              page: args.page as number | undefined,
              per_page: args.per_page as number | undefined,
              search: args.search as string | undefined,
            })
          );
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_get_task",
      description: "Get a Kitchen task by id.",
      inputSchema: z.object({
        id: z.string().describe("Task id"),
      }),
      handler: async (args) => {
        try {
          return ok(await client.get(`/tasks/${args.id}`));
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_create_task",
      description: "Create a Kitchen task. Pass fields supported by the Tasks API.",
      inputSchema: z.object({
        body: z
          .record(z.unknown())
          .describe("Task payload (title, board/list ids, etc.)"),
      }),
      handler: async (args) => {
        try {
          return ok(await client.post("/tasks", args.body));
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_update_task",
      description: "Update a Kitchen task by id.",
      inputSchema: z.object({
        id: z.string().describe("Task id"),
        body: z.record(z.unknown()).describe("Fields to update"),
      }),
      handler: async (args) => {
        try {
          return ok(await client.patch(`/tasks/${args.id}`, args.body));
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_list_boards",
      description: "List Kitchen boards (paginated).",
      inputSchema: z.object({ ...pageQuery }),
      handler: async (args) => {
        try {
          return ok(
            await client.get("/boards", {
              page: args.page as number | undefined,
              per_page: args.per_page as number | undefined,
            })
          );
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_get_board",
      description: "Get a Kitchen board by id.",
      inputSchema: z.object({
        id: z.string().describe("Board id"),
      }),
      handler: async (args) => {
        try {
          return ok(await client.get(`/boards/${args.id}`));
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_list_conversations",
      description: "List Kitchen conversations (paginated).",
      inputSchema: z.object({ ...pageQuery }),
      handler: async (args) => {
        try {
          return ok(
            await client.get("/conversations", {
              page: args.page as number | undefined,
              per_page: args.per_page as number | undefined,
            })
          );
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_get_conversation",
      description: "Get a Kitchen conversation by id.",
      inputSchema: z.object({
        id: z.string().describe("Conversation id"),
      }),
      handler: async (args) => {
        try {
          return ok(await client.get(`/conversations/${args.id}`));
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_list_messages",
      description: "List messages for a Kitchen conversation.",
      inputSchema: z.object({
        conversation_id: z.string().describe("Conversation id"),
        ...pageQuery,
      }),
      handler: async (args) => {
        try {
          return ok(
            await client.get(`/conversations/${args.conversation_id}/messages`, {
              page: args.page as number | undefined,
              per_page: args.per_page as number | undefined,
            })
          );
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_create_message",
      description: "Post a message to a Kitchen conversation.",
      inputSchema: z.object({
        conversation_id: z.string().describe("Conversation id"),
        body: z
          .record(z.unknown())
          .describe("Message payload (e.g. { content: \"...\" })"),
      }),
      handler: async (args) => {
        try {
          return ok(
            await client.post(
              `/conversations/${args.conversation_id}/messages`,
              args.body
            )
          );
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_list_files",
      description: "List Kitchen files (paginated).",
      inputSchema: z.object({ ...pageQuery }),
      handler: async (args) => {
        try {
          return ok(
            await client.get("/files", {
              page: args.page as number | undefined,
              per_page: args.per_page as number | undefined,
            })
          );
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_get_file",
      description: "Get a Kitchen file by id.",
      inputSchema: z.object({
        id: z.string().describe("File id"),
      }),
      handler: async (args) => {
        try {
          return ok(await client.get(`/files/${args.id}`));
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_list_folders",
      description: "List Kitchen folders (paginated).",
      inputSchema: z.object({ ...pageQuery }),
      handler: async (args) => {
        try {
          return ok(
            await client.get("/folders", {
              page: args.page as number | undefined,
              per_page: args.per_page as number | undefined,
            })
          );
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_list_invoices",
      description: "List Kitchen invoices (paginated).",
      inputSchema: z.object({ ...pageQuery }),
      handler: async (args) => {
        try {
          return ok(
            await client.get("/invoices", {
              page: args.page as number | undefined,
              per_page: args.per_page as number | undefined,
            })
          );
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_get_invoice",
      description: "Get a Kitchen invoice by id.",
      inputSchema: z.object({
        id: z.string().describe("Invoice id"),
      }),
      handler: async (args) => {
        try {
          return ok(await client.get(`/invoices/${args.id}`));
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_list_clients",
      description: "List Kitchen clients (paginated).",
      inputSchema: z.object({ ...pageQuery }),
      handler: async (args) => {
        try {
          return ok(
            await client.get("/clients", {
              page: args.page as number | undefined,
              per_page: args.per_page as number | undefined,
            })
          );
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_list_members",
      description: "List Kitchen members (paginated).",
      inputSchema: z.object({ ...pageQuery }),
      handler: async (args) => {
        try {
          return ok(
            await client.get("/members", {
              page: args.page as number | undefined,
              per_page: args.per_page as number | undefined,
            })
          );
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_list_milestones",
      description: "List Kitchen milestones (paginated).",
      inputSchema: z.object({ ...pageQuery }),
      handler: async (args) => {
        try {
          return ok(
            await client.get("/milestones", {
              page: args.page as number | undefined,
              per_page: args.per_page as number | undefined,
            })
          );
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_list_docs",
      description: "List Kitchen docs (paginated).",
      inputSchema: z.object({ ...pageQuery }),
      handler: async (args) => {
        try {
          return ok(
            await client.get("/docs", {
              page: args.page as number | undefined,
              per_page: args.per_page as number | undefined,
            })
          );
        } catch (err) {
          return fail(err);
        }
      },
    },
  ];
}
