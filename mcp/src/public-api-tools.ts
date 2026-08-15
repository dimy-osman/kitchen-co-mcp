import { z } from "zod";
import { KitchenClient } from "./kitchen-client";
import {
  extraBody,
  mergeBody,
  pageQuery,
  RegisteredTool,
  tool,
  visibility,
} from "./tool-helpers";

const folderRoles = [
  "folder_admin",
  "folder_manager",
  "folder_creator",
  "folder_commenter",
  "folder_uploader",
  "folder_viewer",
] as const;

const boardRoles = [
  "board_admin",
  "board_manager",
  "board_editor",
  "board_full_creator",
  "board_creator",
  "board_commenter",
  "board_viewer",
] as const;

const conversationRoles = [
  "conversation_admin",
  "conversation_manager",
  "conversation_commenter",
  "conversation_viewer",
] as const;

const invoiceRoles = [
  "invoice_admin",
  "invoice_manager",
  "invoice_viewer",
] as const;

const milestoneRoles = [
  "milestone_admin",
  "milestone_manager",
  "milestone_viewer",
] as const;

const documentRoles = [
  "document_admin",
  "document_manager",
  "document_editor",
  "document_viewer",
] as const;

const embedRoles = ["embed_admin", "embed_manager", "embed_viewer"] as const;

const linkRoles = ["link_admin", "link_manager", "link_viewer"] as const;

function lifecycle(
  client: KitchenClient,
  spec: { kind: string; path: string; idHint: string }
): RegisteredTool[] {
  const id = z.string().describe(spec.idHint);
  return [
    tool(
      `kitchen_archive_${spec.kind}`,
      `Archive a ${spec.kind} (POST ${spec.path}/{id}/archive). Can be restored later.`,
      z.object({ id }),
      (args) => client.post(`${spec.path}/${args.id}/archive`),
      client
    ),
    tool(
      `kitchen_restore_${spec.kind}`,
      `Restore a ${spec.kind} from archive (POST ${spec.path}/{id}/restore).`,
      z.object({ id }),
      (args) => client.post(`${spec.path}/${args.id}/restore`),
      client
    ),
    tool(
      `kitchen_move_${spec.kind}`,
      `Move a ${spec.kind} to a folder (POST ${spec.path}/{id}/move). parent null = workspace root.`,
      z.object({
        id,
        parent: z
          .string()
          .nullable()
          .optional()
          .describe("Destination folder id, or null for root"),
        extra: extraBody,
      }),
      (args) =>
        client.post(
          `${spec.path}/${args.id}/move`,
          mergeBody({ parent: args.parent ?? null }, args.extra)
        ),
      client
    ),
  ];
}

function memberships(
  client: KitchenClient,
  spec: {
    kind: string;
    path: string;
    idHint: string;
    roles: readonly [string, ...string[]];
  }
): RegisteredTool[] {
  const parentId = z.string().describe(spec.idHint);
  const membershipId = z.string().describe("Membership id (nms_...)");
  const role = z.enum(spec.roles).describe(`Role on this ${spec.kind}`);
  return [
    tool(
      `kitchen_list_${spec.kind}_memberships`,
      `List memberships on a ${spec.kind}.`,
      z.object({ id: parentId }),
      (args) => client.get(`${spec.path}/${args.id}/memberships`),
      client
    ),
    tool(
      `kitchen_create_${spec.kind}_membership`,
      `Add a user or company membership on a ${spec.kind}. Provide user or company.`,
      z.object({
        id: parentId,
        role,
        user: z.string().optional().describe("User id (u_...)"),
        company: z.string().optional().describe("Company id (co_...)"),
        notification: z.string().optional(),
        extra: extraBody,
      }),
      (args) =>
        client.post(
          `${spec.path}/${args.id}/memberships`,
          mergeBody(
            {
              role: args.role,
              user: args.user,
              company: args.company,
              notification: args.notification,
            },
            args.extra
          )
        ),
      client
    ),
    tool(
      `kitchen_update_${spec.kind}_membership`,
      `Change a ${spec.kind} membership role.`,
      z.object({
        id: parentId,
        membership_id: membershipId,
        role,
        extra: extraBody,
      }),
      (args) =>
        client.put(
          `${spec.path}/${args.id}/memberships/${args.membership_id}`,
          mergeBody({ role: args.role }, args.extra)
        ),
      client
    ),
    tool(
      `kitchen_delete_${spec.kind}_membership`,
      `Remove a ${spec.kind} membership.`,
      z.object({ id: parentId, membership_id: membershipId }),
      (args) =>
        client.delete(
          `${spec.path}/${args.id}/memberships/${args.membership_id}`
        ),
      client
    ),
  ];
}

function titleNodeWrites(
  client: KitchenClient,
  spec: {
    kind: string;
    path: string;
    idHint: string;
    roles: readonly [string, ...string[]];
    extraCreate?: Record<string, z.ZodTypeAny>;
  }
): RegisteredTool[] {
  const role = z.enum(spec.roles).optional();
  return [
    tool(
      `kitchen_create_${spec.kind}`,
      `Create a ${spec.kind} (POST ${spec.path}).`,
      z.object({
        title: z.string().optional(),
        description: z.string().optional(),
        visibility,
        role,
        folder: z.string().optional(),
        ...(spec.extraCreate ?? {}),
        extra: extraBody,
      }),
      (args) =>
        client.post(
          spec.path,
          mergeBody(
            {
              title: args.title,
              description: args.description,
              visibility: args.visibility,
              role: args.role,
              folder: args.folder,
              url: args.url,
              start_date: args.start_date,
              due_date: args.due_date,
            },
            args.extra
          )
        ),
      client
    ),
    tool(
      `kitchen_update_${spec.kind}`,
      `Update a ${spec.kind} (PUT ${spec.path}/{id}).`,
      z.object({
        id: z.string().describe(spec.idHint),
        title: z.string().optional(),
        description: z.string().optional(),
        visibility: visibility.optional(),
        extra: extraBody,
      }),
      (args) =>
        client.put(
          `${spec.path}/${args.id}`,
          mergeBody(
            {
              title: args.title,
              description: args.description,
              visibility: args.visibility,
            },
            args.extra
          )
        ),
      client
    ),
    tool(
      `kitchen_delete_${spec.kind}`,
      `Permanently delete a ${spec.kind}.`,
      z.object({ id: z.string().describe(spec.idHint) }),
      (args) => client.delete(`${spec.path}/${args.id}`),
      client
    ),
  ];
}

export function buildPublicApiTools(client: KitchenClient): RegisteredTool[] {
  return [
    ...lifecycle(client, {
      kind: "folder",
      path: "/folders",
      idHint: "Folder id (fo_...)",
    }),
    ...memberships(client, {
      kind: "folder",
      path: "/folders",
      idHint: "Folder id (fo_...)",
      roles: folderRoles,
    }),
    tool(
      "kitchen_list_folder_children",
      "List a folder's children (boards, docs, embeds, conversations, invoices, links, milestones, nested folders).",
      z.object({
        id: z.string().describe("Folder id (fo_...)"),
        object: z
          .array(
            z.enum([
              "conversation",
              "invoice",
              "folder",
              "embed",
              "milestone",
              "board",
              "doc",
              "link",
            ])
          )
          .optional()
          .describe("Filter by child types. Sent as object[]="),
        ...pageQuery,
      }),
      (args) =>
        client.get(`/folders/${args.id}/children`, {
          object: args.object as string[] | undefined,
          page: args.page as number | undefined,
          per_page: args.per_page as number | undefined,
        }),
      client
    ),
    tool(
      "kitchen_list_folder_files",
      "List files attached to a folder.",
      z.object({ id: z.string(), ...pageQuery }),
      (args) =>
        client.get(`/folders/${args.id}/files`, {
          page: args.page as number | undefined,
          per_page: args.per_page as number | undefined,
        }),
      client
    ),
    tool(
      "kitchen_add_folder_files",
      "Attach completed file ids to a folder (POST /folders/{id}/files). Each file can be used once.",
      z.object({
        id: z.string(),
        files: z.array(z.string()).describe("File ids (fi_...)"),
        extra: extraBody,
      }),
      (args) =>
        client.post(
          `/folders/${args.id}/files`,
          mergeBody({ files: args.files }, args.extra)
        ),
      client
    ),

    tool(
      "kitchen_create_template",
      "Create a template from an existing folder (POST /templates). Requires name and folder.",
      z.object({
        name: z.string(),
        folder: z.string().describe("Source folder id"),
        extra: extraBody,
      }),
      (args) =>
        client.post(
          "/templates",
          mergeBody({ name: args.name, folder: args.folder }, args.extra)
        ),
      client
    ),
    tool(
      "kitchen_update_template",
      "Update a template (PUT /templates/{id}).",
      z.object({
        id: z.string(),
        name: z.string().optional(),
        extra: extraBody,
      }),
      (args) =>
        client.put(
          `/templates/${args.id}`,
          mergeBody({ name: args.name }, args.extra)
        ),
      client
    ),
    tool(
      "kitchen_delete_template",
      "Permanently delete a template.",
      z.object({ id: z.string() }),
      (args) => client.delete(`/templates/${args.id}`),
      client
    ),

    ...lifecycle(client, {
      kind: "conversation",
      path: "/conversations",
      idHint: "Conversation id (convr_...)",
    }),
    ...memberships(client, {
      kind: "conversation",
      path: "/conversations",
      idHint: "Conversation id (convr_...)",
      roles: conversationRoles,
    }),
    tool(
      "kitchen_get_message",
      "Get one conversation message.",
      z.object({
        conversation_id: z.string(),
        id: z.string().describe("Message id (msg_...)"),
      }),
      (args) =>
        client.get(`/conversations/${args.conversation_id}/messages/${args.id}`),
      client
    ),
    tool(
      "kitchen_update_message",
      "Update a conversation message (PUT /conversations/{id}/messages/{id}).",
      z.object({
        conversation_id: z.string(),
        id: z.string(),
        content: z.string().optional(),
        send_at: z.string().optional(),
        extra: extraBody,
      }),
      (args) =>
        client.put(
          `/conversations/${args.conversation_id}/messages/${args.id}`,
          mergeBody(
            { content: args.content, send_at: args.send_at },
            args.extra
          )
        ),
      client
    ),
    tool(
      "kitchen_delete_message",
      "Delete a conversation message.",
      z.object({ conversation_id: z.string(), id: z.string() }),
      (args) =>
        client.delete(
          `/conversations/${args.conversation_id}/messages/${args.id}`
        ),
      client
    ),
    tool(
      "kitchen_list_conversation_notes",
      "List notes on a conversation.",
      z.object({ conversation_id: z.string(), ...pageQuery }),
      (args) =>
        client.get(`/conversations/${args.conversation_id}/notes`, {
          page: args.page as number | undefined,
          per_page: args.per_page as number | undefined,
        }),
      client
    ),
    tool(
      "kitchen_get_conversation_note",
      "Get one conversation note.",
      z.object({ conversation_id: z.string(), id: z.string() }),
      (args) =>
        client.get(`/conversations/${args.conversation_id}/notes/${args.id}`),
      client
    ),
    tool(
      "kitchen_create_conversation_note",
      "Add a note to a conversation. Requires content and format.",
      z.object({
        conversation_id: z.string(),
        content: z.string(),
        format: z.enum(["text", "html"]).default("text"),
        extra: extraBody,
      }),
      (args) =>
        client.post(
          `/conversations/${args.conversation_id}/notes`,
          mergeBody(
            { content: args.content, format: args.format ?? "text" },
            args.extra
          )
        ),
      client
    ),
    tool(
      "kitchen_update_conversation_note",
      "Update a conversation note.",
      z.object({
        conversation_id: z.string(),
        id: z.string(),
        content: z.string().optional(),
        format: z.enum(["text", "html"]).optional(),
        extra: extraBody,
      }),
      (args) =>
        client.put(
          `/conversations/${args.conversation_id}/notes/${args.id}`,
          mergeBody(
            { content: args.content, format: args.format },
            args.extra
          )
        ),
      client
    ),
    tool(
      "kitchen_delete_conversation_note",
      "Delete a conversation note.",
      z.object({ conversation_id: z.string(), id: z.string() }),
      (args) =>
        client.delete(`/conversations/${args.conversation_id}/notes/${args.id}`),
      client
    ),
    tool(
      "kitchen_list_conversation_attachments",
      "List attachments on a conversation.",
      z.object({ conversation_id: z.string(), ...pageQuery }),
      (args) =>
        client.get(`/conversations/${args.conversation_id}/attachments`, {
          page: args.page as number | undefined,
          per_page: args.per_page as number | undefined,
        }),
      client
    ),

    ...lifecycle(client, {
      kind: "board",
      path: "/boards",
      idHint: "Board id (tskb_...)",
    }),
    ...memberships(client, {
      kind: "board",
      path: "/boards",
      idHint: "Board id (tskb_...)",
      roles: boardRoles,
    }),
    tool(
      "kitchen_get_list",
      "Get one board list/column.",
      z.object({ id: z.string().describe("List id (tskl_...)") }),
      (args) => client.get(`/lists/${args.id}`),
      client
    ),
    tool(
      "kitchen_delete_list",
      "Permanently delete a list and its tasks.",
      z.object({ id: z.string() }),
      (args) => client.delete(`/lists/${args.id}`),
      client
    ),
    tool(
      "kitchen_list_labels",
      "List labels on a board.",
      z.object({
        board_id: z.string(),
        title: z.string().optional(),
      }),
      (args) =>
        client.get(`/boards/${args.board_id}/labels`, {
          title: args.title as string | undefined,
        }),
      client
    ),
    tool(
      "kitchen_get_label",
      "Get one board label.",
      z.object({ board_id: z.string(), id: z.string() }),
      (args) => client.get(`/boards/${args.board_id}/labels/${args.id}`),
      client
    ),
    tool(
      "kitchen_create_label",
      "Create a label on a board. Requires hex_color.",
      z.object({
        board_id: z.string(),
        hex_color: z.string().describe("Hex color, e.g. #FF00FF"),
        title: z.string().optional(),
        extra: extraBody,
      }),
      (args) =>
        client.post(
          `/boards/${args.board_id}/labels`,
          mergeBody(
            { hex_color: args.hex_color, title: args.title },
            args.extra
          )
        ),
      client
    ),
    tool(
      "kitchen_update_label",
      "Update a board label.",
      z.object({
        board_id: z.string(),
        id: z.string(),
        title: z.string().optional(),
        hex_color: z.string().optional(),
        extra: extraBody,
      }),
      (args) =>
        client.put(
          `/boards/${args.board_id}/labels/${args.id}`,
          mergeBody(
            { title: args.title, hex_color: args.hex_color },
            args.extra
          )
        ),
      client
    ),
    tool(
      "kitchen_delete_label",
      "Permanently delete a board label.",
      z.object({ board_id: z.string(), id: z.string() }),
      (args) => client.delete(`/boards/${args.board_id}/labels/${args.id}`),
      client
    ),
    tool(
      "kitchen_get_custom_field",
      "Get one custom field on a board.",
      z.object({ board_id: z.string(), id: z.string() }),
      (args) =>
        client.get(`/boards/${args.board_id}/custom-fields/${args.id}`),
      client
    ),
    tool(
      "kitchen_create_custom_field",
      "Create a custom field on a board. Requires name and type.",
      z.object({
        board_id: z.string(),
        name: z.string(),
        type: z.enum([
          "text",
          "number",
          "list",
          "multi_list",
          "date",
          "boolean",
          "url",
          "email",
          "phone",
        ]),
        color: z.string().optional(),
        show_icon: z.boolean().optional(),
        visible_to_clients: z.boolean().optional(),
        options: z.record(z.unknown()).optional(),
        extra: extraBody,
      }),
      (args) =>
        client.post(
          `/boards/${args.board_id}/custom-fields`,
          mergeBody(
            {
              name: args.name,
              type: args.type,
              color: args.color,
              show_icon: args.show_icon,
              visible_to_clients: args.visible_to_clients,
              options: args.options,
            },
            args.extra
          )
        ),
      client
    ),
    tool(
      "kitchen_delete_custom_field",
      "Permanently delete a custom field from a board.",
      z.object({ board_id: z.string(), id: z.string() }),
      (args) =>
        client.delete(`/boards/${args.board_id}/custom-fields/${args.id}`),
      client
    ),

    tool(
      "kitchen_move_task",
      "Move a task to a list on a board (POST /tasks/{id}/move).",
      z.object({
        id: z.string(),
        board: z.string(),
        list: z.string(),
        position: z
          .union([z.enum(["top", "bottom"]), z.number().int()])
          .optional(),
        extra: extraBody,
      }),
      (args) =>
        client.post(
          `/tasks/${args.id}/move`,
          mergeBody(
            {
              board: args.board,
              list: args.list,
              position: args.position,
            },
            args.extra
          )
        ),
      client
    ),
    tool(
      "kitchen_toggle_task_completion",
      "Set task completed true/false (GET /tasks/{id}/completed?completed= as documented).",
      z.object({
        id: z.string(),
        completed: z.boolean(),
      }),
      (args) =>
        client.get(`/tasks/${args.id}/completed`, {
          completed: args.completed as boolean,
        }),
      client
    ),
    tool(
      "kitchen_list_subtask_lists",
      "List subtask lists (checklists) on a task.",
      z.object({ task_id: z.string() }),
      (args) => client.get(`/tasks/${args.task_id}/subtask-lists`),
      client
    ),
    tool(
      "kitchen_get_subtask_list",
      "Get one subtask list.",
      z.object({ task_id: z.string(), id: z.string() }),
      (args) => client.get(`/tasks/${args.task_id}/subtask-lists/${args.id}`),
      client
    ),
    tool(
      "kitchen_create_subtask_list",
      "Create a subtask list on a task. Requires name.",
      z.object({
        task_id: z.string(),
        name: z.string(),
        extra: extraBody,
      }),
      (args) =>
        client.post(
          `/tasks/${args.task_id}/subtask-lists`,
          mergeBody({ name: args.name }, args.extra)
        ),
      client
    ),
    tool(
      "kitchen_update_subtask_list",
      "Rename a subtask list.",
      z.object({
        task_id: z.string(),
        id: z.string(),
        name: z.string().optional(),
        extra: extraBody,
      }),
      (args) =>
        client.put(
          `/tasks/${args.task_id}/subtask-lists/${args.id}`,
          mergeBody({ name: args.name }, args.extra)
        ),
      client
    ),
    tool(
      "kitchen_delete_subtask_list",
      "Delete a subtask list.",
      z.object({ task_id: z.string(), id: z.string() }),
      (args) =>
        client.delete(`/tasks/${args.task_id}/subtask-lists/${args.id}`),
      client
    ),
    tool(
      "kitchen_list_subtasks",
      "List subtasks on a task.",
      z.object({ task_id: z.string() }),
      (args) => client.get(`/tasks/${args.task_id}/subtasks`),
      client
    ),
    tool(
      "kitchen_get_subtask",
      "Get one subtask.",
      z.object({
        task_id: z.string(),
        id: z.string(),
        expand: z
          .array(z.enum(["members", "parent", "subtask_list"]))
          .optional(),
      }),
      (args) =>
        client.get(`/tasks/${args.task_id}/subtasks/${args.id}`, {
          expand: args.expand as string[] | undefined,
        }),
      client
    ),
    tool(
      "kitchen_create_subtask",
      "Create a subtask. Requires title and subtask_list.",
      z.object({
        task_id: z.string(),
        title: z.string(),
        subtask_list: z.string(),
        due_at: z.string().nullable().optional(),
        extra: extraBody,
      }),
      (args) =>
        client.post(
          `/tasks/${args.task_id}/subtasks`,
          mergeBody(
            {
              title: args.title,
              subtask_list: args.subtask_list,
              due_at: args.due_at,
            },
            args.extra
          )
        ),
      client
    ),
    tool(
      "kitchen_update_subtask",
      "Update a subtask.",
      z.object({
        task_id: z.string(),
        id: z.string(),
        title: z.string().optional(),
        due_at: z.string().nullable().optional(),
        extra: extraBody,
      }),
      (args) =>
        client.put(
          `/tasks/${args.task_id}/subtasks/${args.id}`,
          mergeBody({ title: args.title, due_at: args.due_at }, args.extra)
        ),
      client
    ),
    tool(
      "kitchen_delete_subtask",
      "Delete a subtask.",
      z.object({ task_id: z.string(), id: z.string() }),
      (args) => client.delete(`/tasks/${args.task_id}/subtasks/${args.id}`),
      client
    ),
    tool(
      "kitchen_list_task_custom_fields",
      "List custom-field values on a task.",
      z.object({ task_id: z.string() }),
      (args) => client.get(`/tasks/${args.task_id}/custom-fields`),
      client
    ),
    tool(
      "kitchen_add_task_custom_field",
      "Set a custom-field value on a task.",
      z.object({
        task_id: z.string(),
        custom_field: z.string(),
        value: z.unknown().optional(),
        extra: extraBody,
      }),
      (args) =>
        client.post(
          `/tasks/${args.task_id}/custom-fields`,
          mergeBody(
            { custom_field: args.custom_field, value: args.value },
            args.extra
          )
        ),
      client
    ),
    tool(
      "kitchen_update_task_custom_field",
      "Update a custom-field value on a task.",
      z.object({
        task_id: z.string(),
        id: z.string().describe("Custom field id (cf_...)"),
        value: z.unknown().optional(),
        extra: extraBody,
      }),
      (args) =>
        client.put(
          `/tasks/${args.task_id}/custom-fields/${args.id}`,
          mergeBody({ value: args.value }, args.extra)
        ),
      client
    ),
    tool(
      "kitchen_remove_task_custom_field",
      "Remove a custom-field value from a task.",
      z.object({ task_id: z.string(), id: z.string() }),
      (args) =>
        client.delete(`/tasks/${args.task_id}/custom-fields/${args.id}`),
      client
    ),
    tool(
      "kitchen_list_task_labels",
      "List labels on a task.",
      z.object({ task_id: z.string() }),
      (args) => client.get(`/tasks/${args.task_id}/labels`),
      client
    ),
    tool(
      "kitchen_add_task_label",
      "Add a board label to a task.",
      z.object({
        task_id: z.string(),
        label: z.string(),
        extra: extraBody,
      }),
      (args) =>
        client.post(
          `/tasks/${args.task_id}/labels`,
          mergeBody({ label: args.label }, args.extra)
        ),
      client
    ),
    tool(
      "kitchen_remove_task_label",
      "Remove a label from a task.",
      z.object({ task_id: z.string(), id: z.string() }),
      (args) => client.delete(`/tasks/${args.task_id}/labels/${args.id}`),
      client
    ),
    tool(
      "kitchen_list_task_members",
      "List members on a task.",
      z.object({ task_id: z.string() }),
      (args) => client.get(`/tasks/${args.task_id}/members`),
      client
    ),
    tool(
      "kitchen_add_task_member",
      "Add a user to a task.",
      z.object({
        task_id: z.string(),
        user: z.string(),
        extra: extraBody,
      }),
      (args) =>
        client.post(
          `/tasks/${args.task_id}/members`,
          mergeBody({ user: args.user }, args.extra)
        ),
      client
    ),
    tool(
      "kitchen_remove_task_member",
      "Remove a user from a task.",
      z.object({ task_id: z.string(), id: z.string() }),
      (args) => client.delete(`/tasks/${args.task_id}/members/${args.id}`),
      client
    ),
    tool(
      "kitchen_list_task_comments",
      "List comments on a task.",
      z.object({ task_id: z.string(), ...pageQuery }),
      (args) =>
        client.get(`/tasks/${args.task_id}/comments`, {
          page: args.page as number | undefined,
          per_page: args.per_page as number | undefined,
        }),
      client
    ),
    tool(
      "kitchen_get_task_comment",
      "Get one task comment.",
      z.object({ task_id: z.string(), id: z.string() }),
      (args) => client.get(`/tasks/${args.task_id}/comments/${args.id}`),
      client
    ),
    tool(
      "kitchen_create_task_comment",
      "Comment on a task. Requires content and format. Optional attachments (file ids).",
      z.object({
        task_id: z.string(),
        content: z.string(),
        format: z.enum(["text", "html"]).default("text"),
        attachments: z.array(z.string()).optional(),
        extra: extraBody,
      }),
      (args) =>
        client.post(
          `/tasks/${args.task_id}/comments`,
          mergeBody(
            {
              content: args.content,
              format: args.format ?? "text",
              attachments: args.attachments,
            },
            args.extra
          )
        ),
      client
    ),
    tool(
      "kitchen_update_task_comment",
      "Update a task comment.",
      z.object({
        task_id: z.string(),
        id: z.string(),
        content: z.string().optional(),
        extra: extraBody,
      }),
      (args) =>
        client.put(
          `/tasks/${args.task_id}/comments/${args.id}`,
          mergeBody({ content: args.content }, args.extra)
        ),
      client
    ),
    tool(
      "kitchen_delete_task_comment",
      "Delete a task comment.",
      z.object({ task_id: z.string(), id: z.string() }),
      (args) => client.delete(`/tasks/${args.task_id}/comments/${args.id}`),
      client
    ),
    tool(
      "kitchen_list_task_attachments",
      "List attachments on a task.",
      z.object({ task_id: z.string(), ...pageQuery }),
      (args) =>
        client.get(`/tasks/${args.task_id}/attachments`, {
          page: args.page as number | undefined,
          per_page: args.per_page as number | undefined,
        }),
      client
    ),
    tool(
      "kitchen_get_task_note",
      "Get one task note.",
      z.object({ task_id: z.string(), id: z.string() }),
      (args) => client.get(`/tasks/${args.task_id}/notes/${args.id}`),
      client
    ),
    tool(
      "kitchen_update_task_note",
      "Update a task note.",
      z.object({
        task_id: z.string(),
        id: z.string(),
        content: z.string().optional(),
        format: z.enum(["text", "html"]).optional(),
        extra: extraBody,
      }),
      (args) =>
        client.put(
          `/tasks/${args.task_id}/notes/${args.id}`,
          mergeBody(
            { content: args.content, format: args.format },
            args.extra
          )
        ),
      client
    ),
    tool(
      "kitchen_delete_task_note",
      "Delete a task note.",
      z.object({ task_id: z.string(), id: z.string() }),
      (args) => client.delete(`/tasks/${args.task_id}/notes/${args.id}`),
      client
    ),

    ...titleNodeWrites(client, {
      kind: "milestone",
      path: "/milestones",
      idHint: "Milestone id (mst_...)",
      roles: milestoneRoles,
      extraCreate: {
        start_date: z.string().optional(),
        due_date: z.string().optional(),
      },
    }),
    ...lifecycle(client, {
      kind: "milestone",
      path: "/milestones",
      idHint: "Milestone id (mst_...)",
    }),
    ...memberships(client, {
      kind: "milestone",
      path: "/milestones",
      idHint: "Milestone id (mst_...)",
      roles: milestoneRoles,
    }),

    tool(
      "kitchen_delete_invoice",
      "Permanently delete an invoice.",
      z.object({ id: z.string() }),
      (args) => client.delete(`/invoices/${args.id}`),
      client
    ),
    ...lifecycle(client, {
      kind: "invoice",
      path: "/invoices",
      idHint: "Invoice id (in_...)",
    }),
    ...memberships(client, {
      kind: "invoice",
      path: "/invoices",
      idHint: "Invoice id (in_...)",
      roles: invoiceRoles,
    }),
    tool(
      "kitchen_list_recurring_invoices",
      "List recurring invoices (paginated).",
      z.object({ ...pageQuery }),
      (args) =>
        client.get("/recurring-invoices", {
          page: args.page as number | undefined,
          per_page: args.per_page as number | undefined,
        }),
      client
    ),
    tool(
      "kitchen_get_recurring_invoice",
      "Get one recurring invoice.",
      z.object({ id: z.string() }),
      (args) => client.get(`/recurring-invoices/${args.id}`),
      client
    ),
    tool(
      "kitchen_create_recurring_invoice",
      "Create a recurring invoice (POST /recurring-invoices).",
      z.object({
        client: z.string().optional(),
        billing_profile: z.string().optional(),
        currency: z.string().optional(),
        items: z.array(z.record(z.unknown())).optional(),
        recurring_name: z.string().optional(),
        recurring_frequency: z.number().int().optional(),
        recurring_period_unit: z.enum(["day", "week", "month", "year"]).optional(),
        recurring_start_date: z.string().optional(),
        recurring_end_date: z.string().optional(),
        target_folder: z.string().optional(),
        extra: extraBody,
      }),
      (args) =>
        client.post(
          "/recurring-invoices",
          mergeBody(
            {
              client: args.client,
              billing_profile: args.billing_profile,
              currency: args.currency,
              items: args.items,
              recurring_name: args.recurring_name,
              recurring_frequency: args.recurring_frequency,
              recurring_period_unit: args.recurring_period_unit,
              recurring_start_date: args.recurring_start_date,
              recurring_end_date: args.recurring_end_date,
              target_folder: args.target_folder,
            },
            args.extra
          )
        ),
      client
    ),
    tool(
      "kitchen_update_recurring_invoice",
      "Update a recurring invoice (PUT /recurring-invoices/{id}).",
      z.object({
        id: z.string(),
        extra: extraBody,
      }),
      (args) =>
        client.put(
          `/recurring-invoices/${args.id}`,
          mergeBody({}, args.extra)
        ),
      client
    ),
    tool(
      "kitchen_delete_recurring_invoice",
      "Permanently delete a recurring invoice.",
      z.object({ id: z.string() }),
      (args) => client.delete(`/recurring-invoices/${args.id}`),
      client
    ),

    tool(
      "kitchen_delete_client",
      "Permanently delete a client.",
      z.object({ id: z.string() }),
      (args) => client.delete(`/clients/${args.id}`),
      client
    ),
    tool(
      "kitchen_delete_company",
      "Permanently delete a company.",
      z.object({ id: z.string() }),
      (args) => client.delete(`/companies/${args.id}`),
      client
    ),

    ...titleNodeWrites(client, {
      kind: "doc",
      path: "/docs",
      idHint: "Doc id (doc_...)",
      roles: documentRoles,
    }),
    ...lifecycle(client, {
      kind: "doc",
      path: "/docs",
      idHint: "Doc id (doc_...)",
    }),
    ...memberships(client, {
      kind: "doc",
      path: "/docs",
      idHint: "Doc id (doc_...)",
      roles: documentRoles,
    }),

    tool(
      "kitchen_list_embeds",
      "List embeds (paginated).",
      z.object({ ...pageQuery }),
      (args) =>
        client.get("/embeds", {
          page: args.page as number | undefined,
          per_page: args.per_page as number | undefined,
        }),
      client
    ),
    tool(
      "kitchen_get_embed",
      "Get one embed.",
      z.object({ id: z.string().describe("Embed id (pe_...)") }),
      (args) => client.get(`/embeds/${args.id}`),
      client
    ),
    ...titleNodeWrites(client, {
      kind: "embed",
      path: "/embeds",
      idHint: "Embed id (pe_...)",
      roles: embedRoles,
      extraCreate: { url: z.string().optional() },
    }),
    ...lifecycle(client, {
      kind: "embed",
      path: "/embeds",
      idHint: "Embed id (pe_...)",
    }),
    ...memberships(client, {
      kind: "embed",
      path: "/embeds",
      idHint: "Embed id (pe_...)",
      roles: embedRoles,
    }),

    tool(
      "kitchen_delete_link",
      "Permanently delete a link.",
      z.object({ id: z.string() }),
      (args) => client.delete(`/links/${args.id}`),
      client
    ),
    ...lifecycle(client, {
      kind: "link",
      path: "/links",
      idHint: "Link id",
    }),
    ...memberships(client, {
      kind: "link",
      path: "/links",
      idHint: "Link id",
      roles: linkRoles,
    }),

    tool(
      "kitchen_create_file",
      "Start a file upload (POST /files). Returns id + upload_url (5 min). PUT the bytes to upload_url yourself (off-origin; kitchen_request will refuse it), then kitchen_complete_file.",
      z.object({
        filename: z.string(),
        extra: extraBody,
      }),
      (args) =>
        client.post(
          "/files",
          mergeBody({ filename: args.filename }, args.extra)
        ),
      client
    ),
    tool(
      "kitchen_complete_file",
      "Finalize a file upload (POST /files/{id}/complete). Then attach once to a folder, message, or comment.",
      z.object({ id: z.string() }),
      (args) => client.post(`/files/${args.id}/complete`),
      client
    ),
    tool(
      "kitchen_delete_file",
      "Permanently delete a file.",
      z.object({ id: z.string() }),
      (args) => client.delete(`/files/${args.id}`),
      client
    ),

    tool(
      "kitchen_list_webhooks",
      "List workspace webhooks.",
      z.object({ ...pageQuery }),
      (args) =>
        client.get("/webhooks", {
          page: args.page as number | undefined,
          per_page: args.per_page as number | undefined,
        }),
      client
    ),
    tool(
      "kitchen_get_webhook",
      "Get one webhook.",
      z.object({ id: z.string() }),
      (args) => client.get(`/webhooks/${args.id}`),
      client
    ),
    tool(
      "kitchen_create_webhook",
      "Create a webhook. Requires url. events is an array of event type strings.",
      z.object({
        url: z.string(),
        events: z.array(z.string()).optional(),
        extra: extraBody,
      }),
      (args) =>
        client.post(
          "/webhooks",
          mergeBody({ url: args.url, events: args.events }, args.extra)
        ),
      client
    ),
    tool(
      "kitchen_update_webhook",
      "Update a webhook (PUT /webhooks/{id}).",
      z.object({
        id: z.string(),
        url: z.string().optional(),
        events: z.array(z.string()).optional(),
        enabled: z.boolean().optional(),
        extra: extraBody,
      }),
      (args) =>
        client.put(
          `/webhooks/${args.id}`,
          mergeBody(
            { url: args.url, events: args.events, enabled: args.enabled },
            args.extra
          )
        ),
      client
    ),
    tool(
      "kitchen_delete_webhook",
      "Delete a webhook.",
      z.object({ id: z.string() }),
      (args) => client.delete(`/webhooks/${args.id}`),
      client
    ),

    tool(
      "kitchen_get_theme_configuration",
      "Get workspace theme configuration (GET /themes/configuration).",
      z.object({}),
      () => client.get("/themes/configuration"),
      client
    ),
  ];
}
