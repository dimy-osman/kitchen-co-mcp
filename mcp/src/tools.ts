import { z } from "zod";
import { KitchenClient } from "./kitchen-client";
import { buildPublicApiTools } from "./public-api-tools";
import {
  extraBody,
  fail,
  mergeBody,
  ok,
  pageQuery,
  RegisteredTool,
  visibility,
} from "./tool-helpers";

const boardRole = z
  .enum([
    "board_admin",
    "board_manager",
    "board_editor",
    "board_full_creator",
    "board_creator",
    "board_commenter",
    "board_viewer",
  ])
  .describe("Default team role when visibility is internal");

const folderRole = z
  .enum([
    "folder_admin",
    "folder_manager",
    "folder_creator",
    "folder_commenter",
    "folder_uploader",
    "folder_viewer",
  ])
  .describe("Default team role when visibility is internal");

const conversationRole = z
  .enum([
    "conversation_admin",
    "conversation_manager",
    "conversation_commenter",
    "conversation_viewer",
  ])
  .describe("Default team role when visibility is internal");

const linkRole = z
  .enum(["link_admin", "link_manager", "link_viewer"])
  .describe("Default team role when visibility is internal");

export type { RegisteredTool } from "./tool-helpers";

export const CAPABILITIES = {
  purpose:
    "Unofficial Kitchen.co MCP. You can use the public Kitchen REST API for this workspace. Prefer named tools. Use kitchen_request for any other same-origin public /api path.",
  docs: "https://developer.kitchen.co/",
  how_to_use: [
    "Call kitchen_capabilities when you need this catalog.",
    "Call kitchen_whoami to confirm auth.",
    "To create a task: kitchen_list_boards or kitchen_get_board, then kitchen_list_lists for that board, then kitchen_create_task with board_id + list + title.",
    "To duplicate a project: kitchen_list_templates, then kitchen_create_folder with template plus optional clone and memberships.",
    "To change access: set visibility (private/internal/shared) and optional role on create/update for boards, folders, conversations, and links.",
    "To change custom-field icons: kitchen_list_custom_fields then kitchen_update_custom_field with show_icon and color.",
    "To fill invoice Bill to / Račun za: kitchen_update_invoice with billing_profile (bp_...). Creating or reading billing profiles is not on the public API.",
    "To expand invoice relations: kitchen_get_invoice with expand: [\"billing_profile\"] (must be an array). kitchen_request query arrays serialize as expand[]=.",
    "To share a node: kitchen_create_{folder|board|conversation|invoice|milestone|doc|embed|link}_membership with user or company plus role.",
    "To upload a file: kitchen_create_file, PUT bytes to the returned upload_url yourself (off-origin), then kitchen_complete_file, then attach once.",
    "Anything not named here: kitchen_request with method + path under public /api. Never call /api/internal.",
  ],
  permissions: {
    visibility: ["private", "internal", "shared"],
    board_roles: [
      "board_admin",
      "board_manager",
      "board_editor",
      "board_full_creator",
      "board_creator",
      "board_commenter",
      "board_viewer",
    ],
    folder_roles: [
      "folder_admin",
      "folder_manager",
      "folder_creator",
      "folder_commenter",
      "folder_uploader",
      "folder_viewer",
    ],
    conversation_roles: [
      "conversation_admin",
      "conversation_manager",
      "conversation_commenter",
      "conversation_viewer",
    ],
    link_roles: ["link_admin", "link_manager", "link_viewer"],
    notes:
      "Set visibility and role when creating or updating boards, folders, conversations, and links. Internal visibility uses the default team role. Shared includes clients.",
  },
  duplication: {
    how: "POST /folders with template (template folder id) plus optional clone and memberships. That clones a Kitchen template into a new folder.",
    tool: "kitchen_create_folder",
  },
  icons: {
    custom_fields:
      "Custom fields support show_icon (boolean) and color. Use kitchen_list_custom_fields and kitchen_update_custom_field.",
    sidebar:
      "Board/folder sidebar icons are not documented on the public API. Try kitchen_request if you discover a field.",
  },
  resources: {
    folders: [
      "list",
      "get",
      "create (incl. clone from template)",
      "update",
      "delete",
      "archive",
      "restore",
      "move",
      "children",
      "files",
      "memberships",
    ],
    boards: [
      "list",
      "get",
      "create",
      "update",
      "delete",
      "archive",
      "restore",
      "move",
      "memberships",
    ],
    lists: ["list", "get", "create", "update", "delete"],
    labels: ["list", "get", "create", "update", "delete on a board"],
    custom_fields: ["list", "get", "create", "update", "delete on a board"],
    tasks: [
      "list",
      "get",
      "create",
      "update",
      "delete",
      "move",
      "toggle completion",
    ],
    subtask_lists: ["list", "get", "create", "update", "delete"],
    subtasks: ["list", "get", "create", "update", "delete"],
    task_notes: ["list", "get", "create", "update", "delete"],
    task_comments: ["list", "get", "create", "update", "delete"],
    task_labels: ["list", "add", "remove"],
    task_members: ["list", "add", "remove"],
    task_custom_fields: ["list", "add", "update", "remove"],
    task_attachments: ["list"],
    conversations: [
      "list",
      "get",
      "create",
      "update",
      "delete",
      "archive",
      "restore",
      "move",
      "memberships",
      "notes",
      "attachments",
    ],
    messages: ["list", "get", "create", "update", "delete"],
    links: [
      "list",
      "get",
      "create",
      "update",
      "delete",
      "archive",
      "restore",
      "move",
      "memberships",
    ],
    files: [
      "list",
      "get",
      "create upload",
      "complete upload",
      "delete",
    ],
    templates: ["list", "get", "create", "update", "delete"],
    clients: ["list", "get", "create", "update", "delete"],
    companies: ["list", "get", "create", "update", "delete"],
    members: ["list", "get"],
    invoices: [
      "list",
      "get (expand)",
      "create",
      "update (incl. billing_profile)",
      "delete",
      "archive",
      "restore",
      "move",
      "memberships",
    ],
    recurring_invoices: ["list", "get", "create", "update", "delete"],
    milestones: [
      "list",
      "get",
      "create",
      "update",
      "delete",
      "archive",
      "restore",
      "move",
      "memberships",
    ],
    docs: [
      "list",
      "get",
      "create",
      "update",
      "delete",
      "archive",
      "restore",
      "move",
      "memberships",
    ],
    embeds: [
      "list",
      "get",
      "create",
      "update",
      "delete",
      "archive",
      "restore",
      "move",
      "memberships",
    ],
    webhooks: ["list", "get", "create", "update", "delete"],
    themes: ["get configuration"],
  },
  auth_boundary: {
    public:
      "Bearer API token against /api/* only. That is the only surface this MCP can call.",
    internal:
      "/api/internal/* is the Kitchen web UI (session cookie + CSRF). Bearer tokens get 401 Unauthenticated. kitchen_request refuses these paths. Do not scrape cookies or CSRF tokens.",
  },
  not_on_public_api: [
    "Client billing-profile CRUD. Docs only publish the object schema. Attach an existing bp_... with kitchen_update_invoice.",
    "Company membership (POST /companies/{id}/users). PUT /clients/{id} with company is ignored.",
    "Invoice finalize and send (email / conversation).",
    "Quotes, proposals, express checkout.",
    "File thread/comment writes (docs publish objects only).",
    "Deprecated Cards API and legacy Attachments API. Use Tasks.",
    "Workspace subscription billing under /api/internal/billing/*.",
  ],
  known_paths: [
    "GET/POST /folders",
    "GET/PUT/DELETE /folders/{id}",
    "GET/POST /boards",
    "GET/PUT/DELETE /boards/{id}",
    "GET/POST /boards/{id}/lists",
    "PUT /lists/{id}",
    "GET/POST /boards/{id}/tasks",
    "GET/PUT/DELETE /tasks/{id}",
    "GET/POST /tasks/{id}/notes",
    "POST /tasks/{id}/subtask-lists",
    "GET/POST /conversations",
    "GET/PUT/DELETE /conversations/{id}",
    "GET/POST /conversations/{id}/messages",
    "GET/POST /links",
    "GET/PUT /links/{id}",
    "GET /templates",
    "GET /templates/{id}",
    "GET /boards/{id}/custom-fields",
    "PUT /custom-fields/{id}",
    "GET /files",
    "POST /files",
    "GET/DELETE /files/{id}",
    "POST /files/{id}/complete",
    "GET/POST /clients",
    "GET/PUT/DELETE /clients/{id}",
    "GET/POST /companies",
    "GET/PUT/DELETE /companies/{id}",
    "GET /members",
    "GET/POST /invoices",
    "GET/PUT/DELETE /invoices/{id}",
    "POST /invoices/{id}/archive|restore|move",
    "GET/POST /recurring-invoices",
    "GET/PUT/DELETE /recurring-invoices/{id}",
    "GET/POST /milestones",
    "GET/PUT/DELETE /milestones/{id}",
    "GET/POST /docs",
    "GET/PUT/DELETE /docs/{id}",
    "GET/POST /embeds",
    "GET/PUT/DELETE /embeds/{id}",
    "GET/POST /webhooks",
    "GET/PUT/DELETE /webhooks/{id}",
    "GET /themes/configuration",
    "POST /{node}/{id}/archive|restore|move",
    "GET/POST /{node}/{id}/memberships",
    "PUT/DELETE /{node}/{id}/memberships/{id}",
  ],
};

export const SERVER_INSTRUCTIONS = [
  "Unofficial Kitchen.co MCP for this workspace. You may use the public Kitchen REST API.",
  "Start with kitchen_capabilities if you need the catalog of tools, permissions, clone, icons, and API gaps.",
  "Prefer named kitchen_* tools. Use kitchen_request for any other same-origin path under public /api.",
  "Bearer tokens cannot call /api/internal (session+CSRF only). Do not scrape cookies.",
  "Create tasks with kitchen_create_task (board_id + list + title). List columns come from kitchen_list_lists.",
  "Duplicate a template with kitchen_create_folder (template, optional clone, memberships).",
  "Permissions: visibility private|internal|shared plus optional role on boards, folders, conversations, links.",
  "Custom-field icons: kitchen_update_custom_field with show_icon and color.",
  "Invoices: create/update/archive/restore/move plus recurring invoices. Pass billing_profile to fill Bill to.",
  "Memberships, labels, subtasks, comments, embeds, webhooks, docs, milestones, and file upload are named tools on the public API.",
  "Client billing-profile CRUD, company user attach, invoice finalize/send, quotes, and proposals are not on the public API.",
  "Docs: https://developer.kitchen.co/",
].join(" ");

export function buildTools(client: KitchenClient): RegisteredTool[] {
  return [
    {
      name: "kitchen_capabilities",
      description:
        "Read this first. Catalog of what this Kitchen MCP can do: resources, permissions, clone, icons, public vs /api/internal auth boundary, and known public-API gaps (billing profiles, company membership).",
      inputSchema: z.object({}),
      handler: async () => ok(CAPABILITIES),
    },
    {
      name: "kitchen_whoami",
      description:
        "Verify Kitchen API credentials. Returns host and current user/member. Never returns the API key.",
      inputSchema: z.object({}),
      handler: async () => {
        try {
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
        "Raw Kitchen API call for a public /api path. Use named tools first. Do not call /api/internal (Bearer 401). Query arrays serialize as key[]=value (Laravel). Example expand: { expand: [\"billing_profile\"] }.",
      inputSchema: z.object({
        method: z
          .enum(["GET", "POST", "PUT", "PATCH", "DELETE"])
          .default("GET")
          .describe("HTTP method"),
        path: z
          .string()
          .describe("Path under public /api, e.g. /folders or /invoices/{id}"),
        query: z
          .record(
            z.union([
              z.string(),
              z.number(),
              z.boolean(),
              z.array(z.union([z.string(), z.number(), z.boolean()])),
            ])
          )
          .optional()
          .describe(
            "Query string. Arrays become key[]=value. expand must be an array."
          ),
        body: z.unknown().optional().describe("JSON body for write methods"),
      }),
      handler: async (args) => {
        try {
          const method = String(args.method ?? "GET").toUpperCase();
          const path = String(args.path);
          const data = await client.request(method, path, {
            query: args.query as Record<
              string,
              string | number | boolean | Array<string | number | boolean> | undefined
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
      name: "kitchen_list_folders",
      description:
        "List folders (paginated). Filter by state (all/active/archived) or name. Folders can hold boards, conversations, and nested folders.",
      inputSchema: z.object({
        ...pageQuery,
        state: z.enum(["all", "active", "archived"]).optional(),
        name: z.string().optional().describe("Name search"),
      }),
      handler: async (args) => {
        try {
          return ok(
            await client.get("/folders", {
              page: args.page as number | undefined,
              per_page: args.per_page as number | undefined,
              state: args.state as string | undefined,
              name: args.name as string | undefined,
            })
          );
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_get_folder",
      description: "Get one folder by id.",
      inputSchema: z.object({ id: z.string().describe("Folder id (fo_...)") }),
      handler: async (args) => {
        try {
          return ok(await client.get(`/folders/${args.id}`));
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_create_folder",
      description:
        "Create a folder. Set visibility and optional role (permissions). To duplicate a template, pass template (template folder id) plus optional clone and memberships.",
      inputSchema: z.object({
        name: z.string().describe("Folder name"),
        visibility,
        role: folderRole.optional(),
        description: z.string().optional(),
        folder: z.string().optional().describe("Parent folder id"),
        template: z
          .string()
          .optional()
          .describe("Template folder id to clone/duplicate"),
        clone: z
          .record(z.unknown())
          .optional()
          .describe("Clone options. Omit to clone the whole template."),
        memberships: z
          .array(z.unknown())
          .optional()
          .describe("Memberships to create after cloning a template"),
        extra: extraBody,
      }),
      handler: async (args) => {
        try {
          return ok(
            await client.post(
              "/folders",
              mergeBody(
                {
                  name: args.name,
                  visibility: args.visibility,
                  role: args.role,
                  description: args.description,
                  folder: args.folder,
                  template: args.template,
                  clone: args.clone,
                  memberships: args.memberships,
                },
                args.extra
              )
            )
          );
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_update_folder",
      description:
        "Update a folder: name, description, visibility (permissions).",
      inputSchema: z.object({
        id: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        visibility: visibility.optional(),
        extra: extraBody,
      }),
      handler: async (args) => {
        try {
          return ok(
            await client.put(
              `/folders/${args.id}`,
              mergeBody(
                {
                  name: args.name,
                  description: args.description,
                  visibility: args.visibility,
                },
                args.extra
              )
            )
          );
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_delete_folder",
      description: "Permanently delete a folder. Cannot be undone.",
      inputSchema: z.object({ id: z.string() }),
      handler: async (args) => {
        try {
          return ok(await client.delete(`/folders/${args.id}`));
        } catch (err) {
          return fail(err);
        }
      },
    },

    {
      name: "kitchen_list_boards",
      description:
        "List boards (paginated). Filter by state or title. Boards hold task lists.",
      inputSchema: z.object({
        ...pageQuery,
        state: z.enum(["all", "active", "archived"]).optional(),
        title: z.string().optional(),
      }),
      handler: async (args) => {
        try {
          return ok(
            await client.get("/boards", {
              page: args.page as number | undefined,
              per_page: args.per_page as number | undefined,
              state: args.state as string | undefined,
              title: args.title as string | undefined,
            })
          );
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_get_board",
      description: "Get one board by id.",
      inputSchema: z.object({ id: z.string().describe("Board id (tskb_...)") }),
      handler: async (args) => {
        try {
          return ok(await client.get(`/boards/${args.id}`));
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_create_board",
      description:
        "Create a board. Requires title and visibility. Optional folder, description, and default team role (permissions).",
      inputSchema: z.object({
        title: z.string(),
        visibility,
        folder: z.string().optional().describe("Parent folder id"),
        description: z.string().optional(),
        role: boardRole.optional(),
        extra: extraBody,
      }),
      handler: async (args) => {
        try {
          return ok(
            await client.post(
              "/boards",
              mergeBody(
                {
                  title: args.title,
                  visibility: args.visibility,
                  folder: args.folder,
                  description: args.description,
                  role: args.role,
                },
                args.extra
              )
            )
          );
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_update_board",
      description: "Update a board: title, description, visibility.",
      inputSchema: z.object({
        id: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        visibility: visibility.optional(),
        extra: extraBody,
      }),
      handler: async (args) => {
        try {
          return ok(
            await client.put(
              `/boards/${args.id}`,
              mergeBody(
                {
                  title: args.title,
                  description: args.description,
                  visibility: args.visibility,
                },
                args.extra
              )
            )
          );
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_delete_board",
      description: "Permanently delete a board. Cannot be undone.",
      inputSchema: z.object({ id: z.string() }),
      handler: async (args) => {
        try {
          return ok(await client.delete(`/boards/${args.id}`));
        } catch (err) {
          return fail(err);
        }
      },
    },

    {
      name: "kitchen_list_tasks",
      description:
        "List tasks. Prefer board_id (GET /boards/{id}/tasks). Without board_id, tries GET /tasks.",
      inputSchema: z.object({
        ...pageQuery,
        board_id: z.string().optional().describe("Board id (recommended)"),
        title: z.string().optional(),
        status: z.enum(["open", "completed"]).optional(),
        search: z.string().optional(),
      }),
      handler: async (args) => {
        try {
          const query = {
            page: args.page as number | undefined,
            per_page: args.per_page as number | undefined,
            title: args.title as string | undefined,
            status: args.status as string | undefined,
            search: args.search as string | undefined,
          };
          const path = args.board_id
            ? `/boards/${args.board_id}/tasks`
            : "/tasks";
          return ok(await client.get(path, query));
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_get_task",
      description: "Get one task by id.",
      inputSchema: z.object({ id: z.string().describe("Task id (tsk_...)") }),
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
      description:
        "Create a task on a board. Requires board_id, list (list id from kitchen_list_lists), and title. Optional assignee, description (HTML ok), due_at, milestone, parent, start_at, remaining_minutes_estimate.",
      inputSchema: z.object({
        board_id: z.string().describe("Board id"),
        list: z.string().describe("List id on that board (tskl_...)"),
        title: z.string(),
        assignee: z.string().optional(),
        description: z.string().optional(),
        due_at: z.string().optional(),
        due_reminder: z.string().optional(),
        milestone: z.string().optional(),
        parent: z.string().optional(),
        start_at: z.string().optional(),
        remaining_minutes_estimate: z.number().int().optional(),
        extra: extraBody,
      }),
      handler: async (args) => {
        try {
          return ok(
            await client.post(
              `/boards/${args.board_id}/tasks`,
              mergeBody(
                {
                  list: args.list,
                  title: args.title,
                  assignee: args.assignee,
                  description: args.description,
                  due_at: args.due_at,
                  due_reminder: args.due_reminder,
                  milestone: args.milestone,
                  parent: args.parent,
                  start_at: args.start_at,
                  remaining_minutes_estimate: args.remaining_minutes_estimate,
                },
                args.extra
              )
            )
          );
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_update_task",
      description:
        "Update a task (PUT). Fields: title, description, assignee, list, due_at, start_at, milestone, remaining_minutes_estimate.",
      inputSchema: z.object({
        id: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        assignee: z.string().nullable().optional(),
        list: z.string().optional(),
        due_at: z.string().nullable().optional(),
        start_at: z.string().nullable().optional(),
        milestone: z.string().nullable().optional(),
        remaining_minutes_estimate: z.number().int().nullable().optional(),
        extra: extraBody,
      }),
      handler: async (args) => {
        try {
          return ok(
            await client.put(
              `/tasks/${args.id}`,
              mergeBody(
                {
                  title: args.title,
                  description: args.description,
                  assignee: args.assignee,
                  list: args.list,
                  due_at: args.due_at,
                  start_at: args.start_at,
                  milestone: args.milestone,
                  remaining_minutes_estimate: args.remaining_minutes_estimate,
                },
                args.extra
              )
            )
          );
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_delete_task",
      description: "Permanently delete a task.",
      inputSchema: z.object({ id: z.string() }),
      handler: async (args) => {
        try {
          return ok(await client.delete(`/tasks/${args.id}`));
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_list_lists",
      description:
        "List columns/lists on a board. You need a list id (tskl_...) to create a task.",
      inputSchema: z.object({
        board_id: z.string(),
        title: z.string().optional(),
        ...pageQuery,
      }),
      handler: async (args) => {
        try {
          return ok(
            await client.get(`/boards/${args.board_id}/lists`, {
              page: args.page as number | undefined,
              per_page: args.per_page as number | undefined,
              title: args.title as string | undefined,
            })
          );
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_create_list",
      description: "Create a list/column on a board. Requires title.",
      inputSchema: z.object({
        board_id: z.string(),
        title: z.string(),
        extra: extraBody,
      }),
      handler: async (args) => {
        try {
          return ok(
            await client.post(
              `/boards/${args.board_id}/lists`,
              mergeBody({ title: args.title }, args.extra)
            )
          );
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_update_list",
      description: "Rename a list/column (PUT /lists/{id}).",
      inputSchema: z.object({
        id: z.string().describe("List id (tskl_...)"),
        title: z.string(),
        extra: extraBody,
      }),
      handler: async (args) => {
        try {
          return ok(
            await client.put(
              `/lists/${args.id}`,
              mergeBody({ title: args.title }, args.extra)
            )
          );
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_list_task_notes",
      description: "List notes on a task.",
      inputSchema: z.object({
        task_id: z.string(),
        content: z.string().optional(),
        ...pageQuery,
      }),
      handler: async (args) => {
        try {
          return ok(
            await client.get(`/tasks/${args.task_id}/notes`, {
              page: args.page as number | undefined,
              per_page: args.per_page as number | undefined,
              content: args.content as string | undefined,
            })
          );
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_create_task_note",
      description:
        "Add a note to a task. Requires content and format (text or html).",
      inputSchema: z.object({
        task_id: z.string(),
        content: z.string(),
        format: z.enum(["text", "html"]).default("text"),
        extra: extraBody,
      }),
      handler: async (args) => {
        try {
          return ok(
            await client.post(
              `/tasks/${args.task_id}/notes`,
              mergeBody(
                { content: args.content, format: args.format ?? "text" },
                args.extra
              )
            )
          );
        } catch (err) {
          return fail(err);
        }
      },
    },

    {
      name: "kitchen_list_conversations",
      description: "List conversations (paginated).",
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
      description: "Get one conversation by id.",
      inputSchema: z.object({
        id: z.string().describe("Conversation id (convr_...)"),
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
      name: "kitchen_create_conversation",
      description:
        "Create a conversation. Requires title and visibility. Optional folder, description, default role (permissions), and an initial message.",
      inputSchema: z.object({
        title: z.string(),
        visibility,
        folder: z.string().optional(),
        description: z.string().optional(),
        role: conversationRole.optional(),
        message: z
          .record(z.unknown())
          .optional()
          .describe("Optional first message payload"),
        extra: extraBody,
      }),
      handler: async (args) => {
        try {
          return ok(
            await client.post(
              "/conversations",
              mergeBody(
                {
                  title: args.title,
                  visibility: args.visibility,
                  folder: args.folder,
                  description: args.description,
                  role: args.role,
                  message: args.message,
                },
                args.extra
              )
            )
          );
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_update_conversation",
      description: "Update a conversation: title, description, visibility.",
      inputSchema: z.object({
        id: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        visibility: visibility.optional(),
        extra: extraBody,
      }),
      handler: async (args) => {
        try {
          return ok(
            await client.put(
              `/conversations/${args.id}`,
              mergeBody(
                {
                  title: args.title,
                  description: args.description,
                  visibility: args.visibility,
                },
                args.extra
              )
            )
          );
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_delete_conversation",
      description: "Permanently delete a conversation if the API allows it.",
      inputSchema: z.object({ id: z.string() }),
      handler: async (args) => {
        try {
          return ok(await client.delete(`/conversations/${args.id}`));
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_list_messages",
      description: "List messages in a conversation.",
      inputSchema: z.object({
        conversation_id: z.string(),
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
      description:
        "Post a message to a conversation. Typical body: { content: \"...\" }.",
      inputSchema: z.object({
        conversation_id: z.string(),
        body: z.record(z.unknown()).describe("Message payload"),
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
      name: "kitchen_list_templates",
      description:
        "List folder templates. Use a template id with kitchen_create_folder to duplicate/clone a project structure.",
      inputSchema: z.object({
        ...pageQuery,
        name: z.string().optional(),
      }),
      handler: async (args) => {
        try {
          return ok(
            await client.get("/templates", {
              page: args.page as number | undefined,
              per_page: args.per_page as number | undefined,
              name: args.name as string | undefined,
            })
          );
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_get_template",
      description: "Get one template by id.",
      inputSchema: z.object({ id: z.string() }),
      handler: async (args) => {
        try {
          return ok(await client.get(`/templates/${args.id}`));
        } catch (err) {
          return fail(err);
        }
      },
    },

    {
      name: "kitchen_list_custom_fields",
      description:
        "List custom fields on a board. Fields may include show_icon and color (icon/color in the Kitchen UI).",
      inputSchema: z.object({
        board_id: z.string(),
        name: z.string().optional(),
      }),
      handler: async (args) => {
        try {
          return ok(
            await client.get(`/boards/${args.board_id}/custom-fields`, {
              name: args.name as string | undefined,
            })
          );
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_update_custom_field",
      description:
        "Update a custom field. Use show_icon and color for icon visibility and color. Also name, options, visible_to_clients.",
      inputSchema: z.object({
        id: z.string().describe("Custom field id (cf_...)"),
        name: z.string().optional(),
        show_icon: z.boolean().optional(),
        color: z.string().nullable().optional(),
        visible_to_clients: z.boolean().optional(),
        extra: extraBody,
      }),
      handler: async (args) => {
        try {
          return ok(
            await client.put(
              `/custom-fields/${args.id}`,
              mergeBody(
                {
                  name: args.name,
                  show_icon: args.show_icon,
                  color: args.color,
                  visible_to_clients: args.visible_to_clients,
                },
                args.extra
              )
            )
          );
        } catch (err) {
          return fail(err);
        }
      },
    },

    {
      name: "kitchen_list_links",
      description: "List links (paginated). Filter by state or title.",
      inputSchema: z.object({
        ...pageQuery,
        state: z.enum(["all", "active", "archived"]).optional(),
        title: z.string().optional(),
      }),
      handler: async (args) => {
        try {
          return ok(
            await client.get("/links", {
              page: args.page as number | undefined,
              per_page: args.per_page as number | undefined,
              state: args.state as string | undefined,
              title: args.title as string | undefined,
            })
          );
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_get_link",
      description: "Get one link by id.",
      inputSchema: z.object({ id: z.string() }),
      handler: async (args) => {
        try {
          return ok(await client.get(`/links/${args.id}`));
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_create_link",
      description:
        "Create a link. Requires title, url, and visibility. Optional folder, description, and role.",
      inputSchema: z.object({
        title: z.string(),
        url: z.string(),
        visibility,
        folder: z.string().optional(),
        description: z.string().optional(),
        role: linkRole.optional(),
        extra: extraBody,
      }),
      handler: async (args) => {
        try {
          return ok(
            await client.post(
              "/links",
              mergeBody(
                {
                  title: args.title,
                  url: args.url,
                  visibility: args.visibility,
                  folder: args.folder,
                  description: args.description,
                  role: args.role,
                },
                args.extra
              )
            )
          );
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_update_link",
      description: "Update a link: title, url, description, visibility.",
      inputSchema: z.object({
        id: z.string(),
        title: z.string().optional(),
        url: z.string().optional(),
        description: z.string().optional(),
        visibility: visibility.optional(),
        extra: extraBody,
      }),
      handler: async (args) => {
        try {
          return ok(
            await client.put(
              `/links/${args.id}`,
              mergeBody(
                {
                  title: args.title,
                  url: args.url,
                  description: args.description,
                  visibility: args.visibility,
                },
                args.extra
              )
            )
          );
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_list_files",
      description: "List files (paginated).",
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
      description: "Get one file by id.",
      inputSchema: z.object({ id: z.string() }),
      handler: async (args) => {
        try {
          return ok(await client.get(`/files/${args.id}`));
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_list_invoices",
      description: "List invoices (paginated).",
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
      description:
        "Get one invoice by id. Pass expand as an array (billing_profile, client, creator). Scalars return 422.",
      inputSchema: z.object({
        id: z.string().describe("Invoice id (in_...)"),
        expand: z
          .array(z.enum(["billing_profile", "client", "creator"]))
          .optional()
          .describe("Relations to expand. Sent as expand[]=..."),
      }),
      handler: async (args) => {
        try {
          return ok(
            await client.get(`/invoices/${args.id}`, {
              expand: args.expand as string[] | undefined,
            })
          );
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_create_invoice",
      description:
        "Create an invoice (POST /invoices). Requires visibility. Optional client, billing_profile (fills Bill to), items, currency, folder, dates. Finalize/send are not on the public API.",
      inputSchema: z.object({
        visibility,
        client: z.string().optional().describe("Client user id (u_...)"),
        billing_profile: z
          .string()
          .optional()
          .describe(
            "Billing profile id (bp_...). Fills PDF Bill to. Profile CRUD is not on the public API."
          ),
        currency: z.string().optional().describe("Three-letter ISO currency"),
        folder: z.string().optional().describe("Folder id to create the invoice in"),
        issue_date: z.string().optional(),
        due_date_in_days: z.number().optional(),
        items: z.array(z.record(z.unknown())).optional(),
        discounts: z.array(z.record(z.unknown())).optional(),
        tax_items: z.array(z.record(z.unknown())).optional(),
        memo: z.string().optional(),
        footer_notes: z.string().optional(),
        language: z.string().optional().describe("Java locale, e.g. en_US or hr_HR"),
        number: z.string().optional(),
        shipping_amount: z.number().optional(),
        role: z
          .enum(["invoice_admin", "invoice_manager", "invoice_viewer"])
          .optional()
          .describe("Default team role when visibility is internal"),
        extra: extraBody,
      }),
      handler: async (args) => {
        try {
          return ok(
            await client.post(
              "/invoices",
              mergeBody(
                {
                  visibility: args.visibility,
                  client: args.client,
                  billing_profile: args.billing_profile,
                  currency: args.currency,
                  folder: args.folder,
                  issue_date: args.issue_date,
                  due_date_in_days: args.due_date_in_days,
                  items: args.items,
                  discounts: args.discounts,
                  tax_items: args.tax_items,
                  memo: args.memo,
                  footer_notes: args.footer_notes,
                  language: args.language,
                  number: args.number,
                  shipping_amount: args.shipping_amount,
                  role: args.role,
                },
                args.extra
              )
            )
          );
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_update_invoice",
      description:
        "Update an invoice (PUT /invoices/{id}). Include billing_profile (bp_...) to fill Bill to. Docs omit that field; the public API accepts it. Send a full payload when Kitchen requires existing items.",
      inputSchema: z.object({
        id: z.string().describe("Invoice id (in_...)"),
        client: z.string().nullable().optional().describe("Client user id (u_...)"),
        billing_profile: z
          .string()
          .nullable()
          .optional()
          .describe("Billing profile id (bp_...). Fills PDF Bill to / Račun za."),
        currency: z.string().optional(),
        issue_date: z.string().nullable().optional(),
        due_date_in_days: z.number().nullable().optional(),
        items: z.array(z.record(z.unknown())).optional(),
        discounts: z.array(z.record(z.unknown())).optional(),
        tax_items: z.array(z.record(z.unknown())).optional(),
        memo: z.string().nullable().optional(),
        footer_notes: z.string().nullable().optional(),
        language: z.string().optional(),
        number: z.string().optional(),
        shipping_amount: z.number().optional(),
        visibility: visibility.optional(),
        extra: extraBody,
      }),
      handler: async (args) => {
        try {
          return ok(
            await client.put(
              `/invoices/${args.id}`,
              mergeBody(
                {
                  client: args.client,
                  billing_profile: args.billing_profile,
                  currency: args.currency,
                  issue_date: args.issue_date,
                  due_date_in_days: args.due_date_in_days,
                  items: args.items,
                  discounts: args.discounts,
                  tax_items: args.tax_items,
                  memo: args.memo,
                  footer_notes: args.footer_notes,
                  language: args.language,
                  number: args.number,
                  shipping_amount: args.shipping_amount,
                  visibility: args.visibility,
                },
                args.extra
              )
            )
          );
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_list_clients",
      description: "List clients (paginated). Filter by name or email.",
      inputSchema: z.object({
        ...pageQuery,
        name: z.string().optional(),
        email: z.string().optional(),
      }),
      handler: async (args) => {
        try {
          return ok(
            await client.get("/clients", {
              page: args.page as number | undefined,
              per_page: args.per_page as number | undefined,
              name: args.name as string | undefined,
              email: args.email as string | undefined,
            })
          );
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_get_client",
      description:
        "Get one client by id. Public payload does not include billingProfile. That object exists only on the internal UI API.",
      inputSchema: z.object({ id: z.string().describe("Client user id (u_...)") }),
      handler: async (args) => {
        try {
          return ok(await client.get(`/clients/${args.id}`));
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_create_client",
      description:
        "Create a client (POST /clients). Requires name and email. Company membership and billing profiles are not on the public API.",
      inputSchema: z.object({
        name: z.string(),
        email: z.string(),
        title: z.string().optional(),
        phone: z.string().nullable().optional(),
        notification: z
          .string()
          .optional()
          .describe("Invite message. Omit to send no notification."),
        extra: extraBody,
      }),
      handler: async (args) => {
        try {
          return ok(
            await client.post(
              "/clients",
              mergeBody(
                {
                  name: args.name,
                  email: args.email,
                  title: args.title,
                  phone: args.phone,
                  notification: args.notification,
                },
                args.extra
              )
            )
          );
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_update_client",
      description:
        "Update a client (PUT /clients/{id}): name, email, title, phone, color, language, timezone, username. company is accepted by this tool but the public API currently ignores it.",
      inputSchema: z.object({
        id: z.string().describe("Client user id (u_...)"),
        name: z.string().optional(),
        email: z.string().optional(),
        title: z.string().nullable().optional(),
        phone: z.string().nullable().optional(),
        color: z.string().optional().describe("Hex color"),
        language: z.string().optional(),
        timezone: z.string().optional(),
        username: z.string().optional(),
        company: z
          .string()
          .nullable()
          .optional()
          .describe(
            "Company id (co_...). Public API currently ignores this (200, company stays null). Membership is internal-only."
          ),
        extra: extraBody,
      }),
      handler: async (args) => {
        try {
          return ok(
            await client.put(
              `/clients/${args.id}`,
              mergeBody(
                {
                  name: args.name,
                  email: args.email,
                  title: args.title,
                  phone: args.phone,
                  color: args.color,
                  language: args.language,
                  timezone: args.timezone,
                  username: args.username,
                  company: args.company,
                },
                args.extra
              )
            )
          );
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_list_companies",
      description: "List companies (paginated). Filter by title.",
      inputSchema: z.object({
        ...pageQuery,
        title: z.string().optional().describe("Company title search"),
      }),
      handler: async (args) => {
        try {
          return ok(
            await client.get("/companies", {
              page: args.page as number | undefined,
              per_page: args.per_page as number | undefined,
              title: args.title as string | undefined,
            })
          );
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_get_company",
      description: "Get one company by id.",
      inputSchema: z.object({ id: z.string().describe("Company id (co_...)") }),
      handler: async (args) => {
        try {
          return ok(await client.get(`/companies/${args.id}`));
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_create_company",
      description:
        "Create a company (POST /companies). Requires unique name. Attaching users is not on the public API.",
      inputSchema: z.object({
        name: z.string().describe("Unique company name"),
        initials: z.string().nullable().optional(),
        website: z.string().nullable().optional(),
        email: z.string().nullable().optional(),
        phone_number: z.string().nullable().optional(),
        address: z.string().nullable().optional(),
        extra: extraBody,
      }),
      handler: async (args) => {
        try {
          return ok(
            await client.post(
              "/companies",
              mergeBody(
                {
                  name: args.name,
                  initials: args.initials,
                  website: args.website,
                  email: args.email,
                  phone_number: args.phone_number,
                  address: args.address,
                },
                args.extra
              )
            )
          );
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_update_company",
      description: "Update a company (PUT /companies/{id}).",
      inputSchema: z.object({
        id: z.string().describe("Company id (co_...)"),
        name: z.string().optional(),
        initials: z.string().nullable().optional(),
        website: z.string().nullable().optional(),
        email: z.string().nullable().optional(),
        phone_number: z.string().nullable().optional(),
        address: z.string().nullable().optional(),
        extra: extraBody,
      }),
      handler: async (args) => {
        try {
          return ok(
            await client.put(
              `/companies/${args.id}`,
              mergeBody(
                {
                  name: args.name,
                  initials: args.initials,
                  website: args.website,
                  email: args.email,
                  phone_number: args.phone_number,
                  address: args.address,
                },
                args.extra
              )
            )
          );
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_list_members",
      description:
        "List workspace members (paginated). Includes workspace role and group.",
      inputSchema: z.object({
        ...pageQuery,
        name: z.string().optional(),
        email: z.string().optional(),
      }),
      handler: async (args) => {
        try {
          return ok(
            await client.get("/members", {
              page: args.page as number | undefined,
              per_page: args.per_page as number | undefined,
              name: args.name as string | undefined,
              email: args.email as string | undefined,
            })
          );
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_get_member",
      description: "Get one member by id.",
      inputSchema: z.object({ id: z.string() }),
      handler: async (args) => {
        try {
          return ok(await client.get(`/members/${args.id}`));
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_list_milestones",
      description: "List milestones (paginated).",
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
      name: "kitchen_get_milestone",
      description: "Get one milestone by id.",
      inputSchema: z.object({ id: z.string() }),
      handler: async (args) => {
        try {
          return ok(await client.get(`/milestones/${args.id}`));
        } catch (err) {
          return fail(err);
        }
      },
    },
    {
      name: "kitchen_list_docs",
      description: "List docs (paginated).",
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
    {
      name: "kitchen_get_doc",
      description: "Get one doc by id.",
      inputSchema: z.object({ id: z.string() }),
      handler: async (args) => {
        try {
          return ok(await client.get(`/docs/${args.id}`));
        } catch (err) {
          return fail(err);
        }
      },
    },
    ...buildPublicApiTools(client),
  ];
}
