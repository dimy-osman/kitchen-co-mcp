# Changelog

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
