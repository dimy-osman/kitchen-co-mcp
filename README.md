# Kitchen.co MCP (Unofficial)

**Unofficial** community extension by [Dimy Osman](https://github.com/dimy-osman).

> **Not affiliated with Kitchen.co.** This is **not** an official Kitchen.co product. It is **not** endorsed, sponsored, or approved by Kitchen.co, 2create.io, or their affiliates. “Kitchen” / “Kitchen.co” identify the third-party API only — no partnership or rights are implied.

Connects IDE to your [Kitchen.co](https://kitchen.co/) workspace so the agent can read and update that work from the editor.

Uses the public [Kitchen API](https://developer.kitchen.co/) and [MCP](https://modelcontextprotocol.io/). You supply your own workspace URL and API token. This extension does not provide Kitchen accounts or Kitchen.co support.

[![Get Kitchen.co](https://img.shields.io/badge/Get-Kitchen.co-0F766E?style=for-the-badge)](https://kitchen.co/)

[![GitHub](https://img.shields.io/badge/GitHub-dimy--osman%2Fkitchen--co--mcp-181717?logo=github&logoColor=white)](https://github.com/dimy-osman/kitchen-co-mcp)
[![Buy me coffee and AI tokens](https://img.shields.io/badge/Buy%20me%20coffee%20and%20AI%20tokens-PayPal-FFD140?logo=paypal&logoColor=003087)](https://www.paypal.com/ncp/payment/DQLKXFVPQCUG6)

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

Once a profile is connected, agents can use the public Kitchen API for that workspace.

Cursor only loads **hot-path** named tools (schemas). Read MCP resource **`kitchen://api-index`** for the compact public-path map, then `kitchen_request`. Resource **`kitchen://capabilities`** (or tool `kitchen_capabilities`) is the full catalog — only if the index is missing or a path fails. Both resources are shipped in this extension, not fetched live from Kitchen.

Hot-path named tools (Bearer `/api` only):

- **Folders** — list, get, children, create (including clone from a template)
- **Boards / lists / labels** — list boards, list columns, list labels, add a label to a task
- **Tasks** — list, get, create, update, move
- **Members / clients** — list members, list/get clients
- **Invoices** — list, get, create
- **Conversations / messages** — list/get conversation, list/get/create message
- **Meta** — `kitchen_whoami`, `kitchen_request`, `kitchen_capabilities`

Other documented public paths (archive, memberships, companies, webhooks, files, docs, embeds, milestones, …) stay available via `kitchen_request` using `kitchen://api-index`. Query arrays serialize as `key[]=value`.

Not on the public API (so not in MCP): client billing-profile CRUD, company user attach, invoice finalize/send, quotes, proposals. Do not scrape cookies. Deprecated Cards / legacy Attachments are skipped on purpose.

Permissions: `visibility` is `private`, `internal`, or `shared`. Internal can take a default team `role`. Shared includes clients.

See [SECURITY.md](./SECURITY.md) for how credentials are stored and what protections apply.

## Commands

| Command | Purpose |
|---------|---------|
| **About / Disclaimer** | Unofficial status and legal notice |
| **Add / Edit / Remove Profile** | Manage workspace URL + API token pairs |
| **List Profiles** | Status (key stored, durable MCP, etc.) |
| **Re-register MCP Servers** | Re-sync workspaces into `mcp.json` if needed |
| **Test Connection** | Quick API check |
| **Show Output Log** | Diagnostics (success is silent on startup) |

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
npm run package   # writes vsix/kitchen-co-mcp-*.vsix
```

Publishing notes for maintainers: [docs/PUBLISH.md](./docs/PUBLISH.md).

## Buy me coffee and AI tokens

If this extension helps, you can [buy me coffee and AI tokens](https://www.paypal.com/ncp/payment/DQLKXFVPQCUG6).

## License

MIT © Dimy Osman — see [LICENSE](./LICENSE).

Kitchen.co and related marks remain the property of their respective owners.
