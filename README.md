# Kitchen.co MCP

**Kitchen.co MCP** by [Dimy Osman](https://github.com/dimy-osman) — project code **KTCH-MCP**.

Cursor / VS Code extension that connects AI agents to the [Kitchen.co API](https://developer.kitchen.co/) via the [Model Context Protocol](https://modelcontextprotocol.io/).

- Multiple workspace profiles (URL + API token pairs)
- API tokens in **OS keychain** (`SecretStorage`) plus a local **envFile** under extension globalStorage
- **Durable** entries merged into `~/.cursor/mcp.json` (survives window reload) — keys never written plaintext into that file
- Optional session registration via Cursor’s `vscode.cursor.mcp.registerServer` API

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
2. Cursor: **Extensions → … → Install from VSIX…** → `kitchen-co-mcp-0.1.1.vsix`
3. Command Palette → **Kitchen.co MCP: Add Profile**
4. Enter name, workspace URL/slug, and API token
5. Confirm under Cursor Settings → MCP and via **List Profiles** (`durable mcp.json: yes`)

## Reload behavior (fixed in 0.1.1)

v0.1.0 unregistered MCP servers in `deactivate()`, so **Developer: Reload Window** removed Kitchen from MCP.  
v0.1.1+ does **not** unregister on deactivate, syncs durable `mcp.json` on activate, retries the Cursor MCP API, and logs to **Kitchen.co MCP: Show Output Log**.

## Commands

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

API reference: https://developer.kitchen.co/

## Develop

```bash
npm install
npm run compile
npm run package
```

Requirements: Node 20+, Cursor (recommended).

## License

MIT © Dimy Osman
