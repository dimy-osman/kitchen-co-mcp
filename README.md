# Kitchen.co MCP (Unofficial)

**Unofficial** community extension by [Dimy Osman](https://github.com/dimy-osman) — project code **KTCH-MCP**.

> **Not affiliated with Kitchen.co.** This project is **not** an official Kitchen.co product, plugin, or service. It is **not** endorsed, sponsored, or approved by Kitchen.co, 2create.io, or their affiliates. “Kitchen” and “Kitchen.co” are marks of their respective owners; use here is for identification only and does **not** imply any partnership, license, or grant of rights.

Cursor / VS Code extension that lets AI agents talk to a [Kitchen.co](https://kitchen.co/) workspace through the public [Kitchen API](https://developer.kitchen.co/) via the [Model Context Protocol](https://modelcontextprotocol.io/).

You must use **your own** Kitchen workspace URL and API token. This extension does not provide Kitchen accounts, hosting, or support from Kitchen.co.

## What it does

- Multiple workspace profiles (URL + API token pairs)
- API tokens in **OS keychain** (`SecretStorage`) plus a local **envFile** under extension globalStorage
- **Durable** entries merged into `~/.cursor/mcp.json` (survives window reload) — keys never written plaintext into that file
- Optional session registration via Cursor’s `vscode.cursor.mcp.registerServer` API

## Disclaimer & legal

- **Unofficial / third-party.** Built independently for personal and community use with Kitchen’s documented public API.
- **No rights granted by Kitchen.co.** Installing or using this software does **not** give you any trademark, copyright, partnership, reseller, or other rights from Kitchen.co or related companies.
- **No official support.** Do not contact Kitchen.co support about this extension. Use [GitHub Issues](https://github.com/dimy-osman/kitchen-co-mcp/issues) for this project only.
- **Your credentials, your responsibility.** API tokens grant access to your Kitchen data. You are responsible for creating, storing, rotating, and revoking tokens, and for any actions agents perform with them.
- **AS IS.** Provided under the [MIT License](./LICENSE) with **no warranties**. The author is not liable for data loss, misuse, security incidents, or business impact from use of this tool.
- **API changes.** Kitchen may change or restrict their API at any time; this extension may break without notice.

## Security

| Stored | Where |
|--------|--------|
| Profile name + base URL | Extension `globalState` |
| API tokens | `SecretStorage` (OS keychain) + `globalStorage/env/kitchen-*.env` (envFile for Cursor) |
| `~/.cursor/mcp.json` | Command/args/base URL only — **no API key plaintext** |
| Git | **Never** — `.env`, `*.env`, `*.vsix`, build outputs gitignored |

Do **not** commit real API keys. Create tokens in Kitchen → Settings → Developer → API Token; enter them only via **Add Profile** (password input).

## Install (VSIX)

1. Build: `npm install && npm run package`
2. Cursor: **Extensions → … → Install from VSIX…** → `kitchen-co-mcp-0.1.2.vsix`
3. Acknowledge the unofficial notice (first run), then **Kitchen.co MCP: Add Profile**
4. Enter name, workspace URL/slug, and API token
5. Confirm under Cursor Settings → MCP and via **List Profiles** (`durable mcp.json: yes`)

## Commands

- **About / Disclaimer** — unofficial status and legal notice
- **Add / Edit / Remove Profile**
- **List Profiles** — key status, durable mcp.json yes/no, dynamic register yes/no
- **Re-register MCP Servers** — sync durable + dynamic
- **Test Connection**
- **Show Output Log**

## Settings

- `kitchenMcp.autoRegister` (default `true`) — sync on startup
- `kitchenMcp.persistToUserMcpJson` (default `true`) — merge into `~/.cursor/mcp.json`

## Standalone MCP (manual)

```json
{
  "mcpServers": {
    "kitchen-acme": {
      "command": "node",
      "args": ["/absolute/path/to/kitchen-co-mcp/mcp/dist/index.js"],
      "env": {
        "KITCHEN_BASE_URL": "https://acme.kitchen.co",
        "KITCHEN_API_KEY": "${env:KITCHEN_ACME_KEY}"
      }
    }
  }
}
```

Or use `envFile` pointing at a local file that defines `KITCHEN_API_KEY` (what the extension writes under globalStorage).

## MCP tools (selected)

| Tool | Purpose |
|------|---------|
| `kitchen_whoami` | Auth probe (no key in response) |
| `kitchen_list_tasks` / `kitchen_get_task` | Tasks |
| `kitchen_create_task` / `kitchen_update_task` | Task writes |
| `kitchen_list_boards` / `kitchen_get_board` | Boards |
| `kitchen_list_conversations` / messages | Conversations |
| `kitchen_list_files` / folders / invoices / clients / members / docs | Other resources |
| `kitchen_request` | Low-level GET/POST/… under `/api` |

API reference: https://developer.kitchen.co/ (Kitchen’s docs; not part of this project)

## Develop

```bash
npm install
npm run compile
npm run package
```

Requirements: Node 20+, Cursor (recommended).

## License

MIT © Dimy Osman — see [LICENSE](./LICENSE).

Kitchen.co and related marks remain the property of their respective owners.
