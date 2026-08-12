# Kitchen.co MCP

**Kitchen.co MCP** by [Dimy Osman](https://github.com/dimy-osman) — project code **KTCH-MCP**.

Cursor / VS Code extension that connects AI agents to the [Kitchen.co API](https://developer.kitchen.co/) via the [Model Context Protocol](https://modelcontextprotocol.io/).

- Multiple workspace profiles (URL + API token pairs)
- API tokens stored in the **OS keychain** via VS Code `SecretStorage` (never written to disk config)
- Registers a local **stdio** MCP server per profile with Cursor’s `vscode.cursor.mcp.registerServer` API

## Security

| Stored | Where |
|--------|--------|
| Profile name + base URL | Extension `globalState` (not secrets) |
| API tokens | `SecretStorage` → OS keychain |
| Tokens in git | **Never** — `.env`, `*.vsix` credentials, and local MCP overrides are gitignored |

Do **not** commit real API keys. Use Settings → Developer → API Token in Kitchen to create tokens, and add them only through the extension commands (password input).

## Install (VSIX)

1. Build: `npm install && npm run package`
2. In Cursor: **Extensions → … → Install from VSIX…** and pick `kitchen-co-mcp-0.1.0.vsix`
3. Command Palette → **Kitchen.co MCP: Add Profile**
4. Enter name, workspace URL/slug, and API token
5. Agents can use tools from the registered `kitchen-<profile>` MCP server

## Commands

- **Add Profile** / **Edit Profile** / **Remove Profile**
- **List Profiles** (shows whether a key is stored; never prints the key)
- **Re-register MCP Servers**
- **Test Connection**

## Standalone MCP (without extension UI)

For `~/.cursor/mcp.json` / `.cursor/mcp.json` — use env vars, never hardcode tokens:

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

Set `KITCHEN_ACME_KEY` in your user environment. Copy `.env.example` → `.env` only for local experiments; `.env` is gitignored.

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

Requirements: Node 20+, Cursor (for MCP registration API) or VS Code (profiles/UI still work; register via `mcp.json` if needed).

## License

MIT © Dimy Osman
