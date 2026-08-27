# Changelog

## 0.7.3 - 2026-08-27

### Fixed
- Windows activate no longer fails with `EPERM` when rewriting the API-key env file while Cursor has it open. Unchanged env / `mcp.json` entries are left alone; a locked dest falls back to in-place overwrite after retry

## 0.7.2 - 2026-08-23

### Fixed
- Capabilities catalog no longer lists theme configuration or a collection `GET /files` as public. Those were live 404 / 405 on Bearer tokens
- Catalog now names the on-demand MCP resources (`kitchen://api-index`, `kitchen://capabilities`)

## 0.7.1 - 2026-08-23

### Added
- MCP resources `kitchen://api-index` (compact path map) and `kitchen://capabilities` (full catalog). Read on demand instead of stuffing the index into server instructions

### Fixed
- Path index: `GET /files` is not public (405; POST to start upload). Theme configuration is not on the public Bearer API (404)

### Changed
- Server instructions are a short pointer to the hot-path tools and those two resources, not the full index

## 0.7.0 - 2026-08-23

### Changed
- MCP `tools/list` advertises **27** named tools (hot path + `kitchen_whoami` + `kitchen_request` + `kitchen_capabilities`) instead of ~199 JSON Schemas
- Compact public-path index so agents can call `kitchen_request` without loading ~199 JSON Schemas (moved to MCP resources in 0.7.1)
- `kitchen_capabilities` still returns the full catalog (`hot_path`, `request_index`, gaps) on demand

### Removed
- Remaining public-API wrappers from `tools/list` (archive/restore/move, memberships, webhooks, embeds, docs writes, files, companies, etc.). Those paths stay in the index and `kitchen_request`; handler code is still in the repo for later promotion

## 0.6.0 - 2026-08-20

### Removed
- The four `kitchenMcp.*` Settings toggles. Behavior is fixed: sync workspaces into `mcp.json` on startup, keep the API-key env file, never wipe it on reload

## 0.5.1 - 2026-08-20

### Fixed
- One Kitchen MCP server per profile. Durable `mcp.json` is the server; leftover session `registerServer` duplicates are dropped
- Stop wiping the API-key env file on deactivate by default. That race made Cursor spawn with no `KITCHEN_API_KEY` and close the connection

## 0.5.0 - 2026-08-15

### Added
- Named tools for the rest of the documented public Kitchen API: archive/restore/move and memberships on folders, boards, conversations, invoices, milestones, docs, embeds, and links
- Folder children and folder files; board labels and custom-field create/get/delete; list get/delete
- Task move, toggle completion, subtask lists, subtasks, comments, labels, members, custom-field values, attachments, and full task-note CRUD
- Conversation messages get/update/delete, conversation notes, conversation attachments
- Embeds, webhooks, recurring invoices, templates write, docs write, milestones write
- File upload start/complete/delete; client and company delete; theme configuration
- `kitchen_capabilities` now lists the full public named surface and the remaining platform gaps

### Changed
- Tool helpers live in `mcp/src/tool-helpers.ts`; extra public tools in `mcp/src/public-api-tools.ts`

## 0.4.0 - 2026-08-15

### Added
- Named tools for public finance/CRM writes: `kitchen_create_client`, `kitchen_update_client`, `kitchen_list_companies`, `kitchen_get_company`, `kitchen_create_company`, `kitchen_update_company`, `kitchen_create_invoice`, `kitchen_update_invoice`
- `billing_profile` on invoice create/update (fills PDF Bill to; documented on the invoice object, omitted from update-invoice docs)
- `expand` array on `kitchen_get_invoice` (`billing_profile`, `client`, `creator`)
- `kitchen_capabilities` auth boundary and `not_on_public_api` list so agents stop guessing `/api/internal`

### Changed
- `kitchen_request` query values may be arrays; they serialize as Laravel `key[]=value`. A scalar `expand` is coerced to `expand[]=`
- `kitchen_request` refuses `/api/internal` with a clear error instead of a Bearer 401
- `known_paths` includes companies, client writes, and invoice writes

## 0.3.0 - 2026-08-15

### Added
- `kitchen_capabilities` catalog so agents know what this MCP can do (resources, permissions, clone, icons, known paths)
- Server instructions on MCP connect
- Create / update / delete for folders, boards, and conversations
- Folder clone from a template (`template`, `clone`, `memberships`)
- Board lists (list / create / rename) so tasks can be created with a list id
- Task notes (list / create)
- Links (list / get / create / update)
- Templates list/get
- Custom fields list/update (`show_icon`, `color`)
- Task delete; create task posts to `/boards/{id}/tasks`

### Changed
- Task updates use PUT `/tasks/{id}` to match Kitchen docs
- `kitchen_request` description tells agents to use named tools first, then any `/api` path
- README "What you can do" lists the full named surface

## 0.2.4 — 2026-08-12

### Changed
- README: marketplace install is the primary path; build-from-source under Development
- Clearer end-user setup and marketplace listing description

## 0.2.3 — 2026-08-12

### Changed
- Icon: transparent background with equal padding; white hat fill, black outline
- Removed internal project codename from public-facing copy
- Quiet startup notifications (errors only); one-time setup prompt

## 0.2.2 — 2026-08-12

### Changed
- No startup notification spam: success sync is silent; toasts only on errors
- One-time setup prompt on first install only

## 0.2.1 — 2026-08-12

### Changed
- Official extension icon from custom Kitchen MCP SVG (chef-hat + MCP)

## 0.2.0 — 2026-08-12

### Security
- AES-256-GCM encrypted credential vault (master key in SecretStorage)
- HTTPS-only URL validation; block private/localhost/metadata hosts (SSRF)
- Same-origin enforcement and `redirect: "error"` in Kitchen HTTP client
- Path containment for MCP scripts and env files
- `mcp.json` writes only touch extension-owned entries; atomic write + backup
- Secret redaction in logs and error UI
- Optional wipe of plaintext env files on deactivate (default on)
- Stricter profile ID / slug / token validation

### Marketplace readiness
- Display name marks **Unofficial**
- Extension icon, NOTICE, SECURITY.md, expanded README disclaimer
- About / first-run legal acknowledgment

## 0.1.2 — 2026-08-12

- Unofficial branding and legal disclaimer UX

## 0.1.1 — 2026-08-12

- Fix MCP disappearing on reload (#1): no unregister on deactivate; durable `mcp.json`

## 0.1.0 — 2026-08-12

- Initial unofficial Kitchen.co MCP extension
