import type { RegisteredTool } from "./tool-helpers";

/**
 * Named tools advertised on tools/list. Everything else is kitchen_request
 * plus kitchen_request and resources kitchen://api-index / kitchen://capabilities.
 */
export const HOT_PATH_TOOLS: readonly string[] = [
  "kitchen_capabilities",
  "kitchen_whoami",
  "kitchen_request",
  "kitchen_list_folders",
  "kitchen_get_folder",
  "kitchen_list_folder_children",
  "kitchen_create_folder",
  "kitchen_list_boards",
  "kitchen_list_lists",
  "kitchen_list_tasks",
  "kitchen_get_task",
  "kitchen_create_task",
  "kitchen_update_task",
  "kitchen_move_task",
  "kitchen_list_labels",
  "kitchen_add_task_label",
  "kitchen_list_members",
  "kitchen_list_clients",
  "kitchen_get_client",
  "kitchen_list_invoices",
  "kitchen_get_invoice",
  "kitchen_create_invoice",
  "kitchen_list_conversations",
  "kitchen_get_conversation",
  "kitchen_list_messages",
  "kitchen_get_message",
  "kitchen_create_message",
];

export const HOT_PATH_SET = new Set(HOT_PATH_TOOLS);

/**
 * Compact catalog for MCP instructions. One line per public path that is
 * not a hot-path named tool. Agents call kitchen_request with method + path.
 * This is our shipped map of developer.kitchen.co, not a live Kitchen dump.
 */
export const REQUEST_INDEX: readonly string[] = [
  "GET /folders/{id}/files | POST /folders/{id}/files — folder files; POST body { files: [fi_...] }",
  "PUT /folders/{id} — update folder (name, description, visibility)",
  "DELETE /folders/{id} — permanently delete folder",
  "POST /folders/{id}/archive | /restore | /move — archive, restore, move (move body { parent })",
  "GET/POST /folders/{id}/memberships — list/add folder memberships",
  "PUT/DELETE /folders/{id}/memberships/{id} — update/remove folder membership",
  "GET /boards/{id} | PUT /boards/{id} | DELETE /boards/{id} — get/update/delete board",
  "POST /boards — create board { title, visibility, folder? }",
  "POST /boards/{id}/archive | /restore | /move",
  "GET/POST /boards/{id}/memberships ; PUT/DELETE /boards/{id}/memberships/{id}",
  "GET /lists/{id} | POST /boards/{id}/lists | PUT /lists/{id} | DELETE /lists/{id}",
  "GET/POST /boards/{id}/labels ; GET/PUT/DELETE /boards/{id}/labels/{id} — label CRUD (hex_color on create)",
  "GET/POST /boards/{id}/custom-fields ; GET/PUT/DELETE /custom-fields/{id} — show_icon, color",
  "DELETE /tasks/{id} — delete task",
  "GET /tasks/{id}/completed?completed=true|false — toggle complete (as documented)",
  "GET/POST /tasks/{id}/notes ; GET/PUT/DELETE /tasks/{id}/notes/{id}",
  "GET/POST /tasks/{id}/comments ; GET/PUT/DELETE /tasks/{id}/comments/{id}",
  "GET/POST /tasks/{id}/subtask-lists ; GET/PUT/DELETE /tasks/{id}/subtask-lists/{id}",
  "GET/POST /tasks/{id}/subtasks ; GET/PUT/DELETE /tasks/{id}/subtasks/{id}",
  "GET /tasks/{id}/labels ; DELETE /tasks/{id}/labels/{id} — list/remove task labels",
  "GET/POST /tasks/{id}/members ; DELETE /tasks/{id}/members/{id}",
  "GET/POST /tasks/{id}/custom-fields ; PUT/DELETE /tasks/{id}/custom-fields/{id}",
  "GET /tasks/{id}/attachments",
  "POST /conversations — create { title, visibility, folder?, message? }",
  "PUT/DELETE /conversations/{id}",
  "POST /conversations/{id}/archive | /restore | /move",
  "GET/POST /conversations/{id}/memberships ; PUT/DELETE .../memberships/{id}",
  "GET/PUT/DELETE /conversations/{id}/messages/{id} — get is named; update/delete via request",
  "GET/POST /conversations/{id}/notes ; GET/PUT/DELETE /conversations/{id}/notes/{id}",
  "GET /conversations/{id}/attachments",
  "GET/POST /templates ; GET/PUT/DELETE /templates/{id} — clone: kitchen_create_folder with template",
  "GET/POST /links ; GET/PUT/DELETE /links/{id} ; archive|restore|move ; memberships",
  "POST /files — start upload only (GET /files is 405). GET/DELETE /files/{id} ; POST /files/{id}/complete — PUT bytes to upload_url yourself",
  "PUT /invoices/{id} — update invoice (billing_profile fills Bill to)",
  "DELETE /invoices/{id} ; POST /invoices/{id}/archive|restore|move",
  "GET/POST /invoices/{id}/memberships ; PUT/DELETE .../memberships/{id}",
  "GET/POST /recurring-invoices ; GET/PUT/DELETE /recurring-invoices/{id}",
  "POST /clients ; PUT/DELETE /clients/{id} — company on PUT is ignored by public API",
  "GET /members/{id}",
  "GET/POST /companies ; GET/PUT/DELETE /companies/{id} — attaching users is not public",
  "GET/POST /milestones ; GET/PUT/DELETE /milestones/{id} ; archive|restore|move ; memberships",
  "GET/POST /docs ; GET/PUT/DELETE /docs/{id} ; archive|restore|move ; memberships",
  "GET/POST /embeds ; GET/PUT/DELETE /embeds/{id} ; archive|restore|move ; memberships",
  "GET/POST /webhooks ; GET/PUT/DELETE /webhooks/{id}",
  "Theme config is not on the public Bearer API (GET /themes/configuration and GET /themes return 404).",
  "Query arrays: expand[]=billing_profile (never scalar expand)",
];

export const API_INDEX_URI = "kitchen://api-index";
export const CAPABILITIES_URI = "kitchen://capabilities";
export const API_INDEX_TEXT = REQUEST_INDEX.join("\n");

export function filterHotPathTools(tools: RegisteredTool[]): RegisteredTool[] {
  const hot = tools.filter((t) => HOT_PATH_SET.has(t.name));
  if (hot.length !== HOT_PATH_TOOLS.length) {
    const have = new Set(hot.map((t) => t.name));
    const missing = HOT_PATH_TOOLS.filter((n) => !have.has(n));
    throw new Error(
      `Hot-path MCP tools missing implementations: ${missing.join(", ")}`
    );
  }
  return HOT_PATH_TOOLS.map((name) => {
    const tool = hot.find((t) => t.name === name);
    if (!tool) {
      throw new Error(`Hot-path tool not found: ${name}`);
    }
    return tool;
  });
}
