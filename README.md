# Kitchen.co MCP (Unofficial)

**Unofficial** community extension by [Dimy Osman](https://github.com/dimy-osman).

> **Not affiliated with Kitchen.co.** This is **not** an official Kitchen.co product. It is **not** endorsed, sponsored, or approved by Kitchen.co, 2create.io, or their affiliates. “Kitchen” / “Kitchen.co” identify the third-party API only — no partnership or rights are implied.

Connect [Cursor](https://cursor.com/) / VS Code AI agents to **your** [Kitchen.co](https://kitchen.co/) workspace through the public [Kitchen API](https://developer.kitchen.co/) and [MCP](https://modelcontextprotocol.io/).

You supply your own workspace URL and API token. This extension does not provide Kitchen accounts or Kitchen.co support.

## Install

### Recommended — Extensions marketplace

1. Open **Extensions** in Cursor (or another Open VSX–compatible editor).
2. Search for **`Kitchen.co MCP (Unofficial)`** or **`dimy-osman.kitchen-co-mcp`**.
3. Click **Install**.

Listings:

- [Open VSX](https://open-vsx.org/extension/dimy-osman/kitchen-co-mcp)
- [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=dimy-osman.kitchen-co-mcp)

### After install

1. Acknowledge the one-time unofficial notice (first run only).
2. Command Palette → **Kitchen.co MCP: Add Profile**.
3. Enter a profile name, your workspace URL (or slug), and API token from Kitchen → **Settings → Developer → API Token**.
4. Optional: **List Profiles** to confirm the profile is ready (`durable mcp.json: yes`).

Tokens stay on your machine (OS keychain + encrypted vault). They are never written into `mcp.json` as plaintext.

### Alternative — Install from VSIX

If you prefer a local package: download a release VSIX from GitHub, or build one (see [Development](#development)), then **Extensions → ⋯ → Install from VSIX…**.

## What you can do

Once a profile is connected, agents can use Kitchen MCP tools to:

- Read conversations, messages, files, folders, boards, invoices, clients, members, docs, milestones
- Create / update tasks and post conversation messages
- Call other same-origin Kitchen API paths via `kitchen_request`

See [SECURITY.md](./SECURITY.md) for how credentials are stored and what protections apply.

## Commands

| Command | Purpose |
|---------|---------|
| **About / Disclaimer** | Unofficial status and legal notice |
| **Add / Edit / Remove Profile** | Manage workspace URL + API token pairs |
| **List Profiles** | Status (key stored, durable MCP, etc.) |
| **Re-register MCP Servers** | Re-sync if tools disappear |
| **Test Connection** | Quick API check |
| **Show Output Log** | Diagnostics (success is silent on startup) |

## Settings

| Setting | Default | Purpose |
|---------|---------|---------|
| `kitchenMcp.autoRegister` | `true` | Sync MCP on startup |
| `kitchenMcp.persistToUserMcpJson` | `true` | Keep durable entries in `~/.cursor/mcp.json` |
| `kitchenMcp.writePlaintextEnvFile` | `true` | Short-lived env files for Cursor spawn |
| `kitchenMcp.wipeEnvFilesOnDeactivate` | `true` | Wipe those env files when the extension stops |

Startup success is silent; you only get a toast if something fails. Setup help appears once on first install.

## Disclaimer & legal

- **Unofficial / third-party** — independent use of Kitchen’s public API.
- **No rights from Kitchen.co** — no trademark license, partnership, or official support.
- **Support** — use [GitHub Issues](https://github.com/dimy-osman/kitchen-co-mcp/issues) only; do **not** contact Kitchen.co about this extension.
- **Your credentials** — you are responsible for tokens and for actions agents take with them.
- **AS IS** — [MIT License](./LICENSE); no warranties. Kitchen may change their API at any time.

See [NOTICE](./NOTICE).

## Development

For contributors building from source:

```bash
npm install
npm run compile
npm run lint
npm run audit
npm run package   # produces kitchen-co-mcp-*.vsix
```

Publishing notes for maintainers: [docs/PUBLISH.md](./docs/PUBLISH.md).

## License

MIT © Dimy Osman — see [LICENSE](./LICENSE).

Kitchen.co and related marks remain the property of their respective owners.
