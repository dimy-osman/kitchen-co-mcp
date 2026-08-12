# Kitchen.co MCP (Unofficial)

**Unofficial** community extension by [Dimy Osman](https://github.com/dimy-osman).

> **Not affiliated with Kitchen.co.** This project is **not** an official Kitchen.co product, plugin, or service. It is **not** endorsed, sponsored, or approved by Kitchen.co, 2create.io, or their affiliates. “Kitchen” and “Kitchen.co” are marks of their respective owners; use here is for identification only and does **not** imply any partnership, license, or grant of rights.

Cursor / VS Code extension that lets AI agents talk to a [Kitchen.co](https://kitchen.co/) workspace through the public [Kitchen API](https://developer.kitchen.co/) via the [Model Context Protocol](https://modelcontextprotocol.io/).

You must use **your own** Kitchen workspace URL and API token. This extension does not provide Kitchen accounts, hosting, or support from Kitchen.co.

## What it does

- Multiple workspace profiles (URL + API token pairs)
- Tokens in **OS keychain** (SecretStorage) + **AES-256-GCM encrypted vault**
- Durable `~/.cursor/mcp.json` entries **without plaintext keys**
- Optional short-lived env files for Cursor spawn (wiped on deactivate by default)
- SSRF protections, path containment, secret redaction — see [SECURITY.md](./SECURITY.md)

## Disclaimer & legal

- **Unofficial / third-party.** Built independently for personal and community use with Kitchen’s documented public API.
- **No rights granted by Kitchen.co.** Installing or using this software does **not** give you any trademark, copyright, partnership, reseller, or other rights from Kitchen.co or related companies.
- **No official support.** Do not contact Kitchen.co support about this extension. Use [GitHub Issues](https://github.com/dimy-osman/kitchen-co-mcp/issues) for this project only.
- **Your credentials, your responsibility.** API tokens grant access to your Kitchen data. You are responsible for creating, storing, rotating, and revoking tokens, and for any actions agents perform with them.
- **AS IS.** Provided under the [MIT License](./LICENSE) with **no warranties**. The author is not liable for data loss, misuse, security incidents, or business impact from use of this tool.
- **API changes.** Kitchen may change or restrict their API at any time; this extension may break without notice.

See also [NOTICE](./NOTICE).

## Install (VSIX)

1. `npm install && npm run package`
2. Cursor: **Extensions → … → Install from VSIX…** → `kitchen-co-mcp-0.2.0.vsix`
3. Acknowledge the unofficial notice (first run), then **Add Profile**
4. Confirm **List Profiles** shows `durable mcp.json: yes`

### Marketplace

Publish with your VSCE/Open VSX publisher account (`vsce publish` / `ovsx publish`). Publisher id: `dimy-osman`. This repo does not store marketplace login tokens.

## Commands

- **About / Disclaimer**
- **Add / Edit / Remove Profile**
- **List Profiles**
- **Re-register MCP Servers**
- **Test Connection**
- **Show Output Log**

## Settings

| Setting | Default | Purpose |
|---------|---------|---------|
| `kitchenMcp.autoRegister` | `true` | Sync on startup |
| `kitchenMcp.persistToUserMcpJson` | `true` | Durable mcp.json merge |
| `kitchenMcp.writePlaintextEnvFile` | `true` | Short-lived env files for Cursor spawn |
| `kitchenMcp.wipeEnvFilesOnDeactivate` | `true` | Wipe those env files on deactivate |

## MCP tools (selected)

| Tool | Purpose |
|------|---------|
| `kitchen_whoami` | Auth probe (no key in response) |
| `kitchen_list_*` / `kitchen_get_*` | Read resources |
| `kitchen_create_task` / `kitchen_update_task` | Task writes |
| `kitchen_create_message` | Post conversation messages |
| `kitchen_request` | Low-level same-origin `/api` calls |

## Develop

```bash
npm install
npm run compile
npm run lint
npm run audit
npm run package
```

## License

MIT © Dimy Osman — see [LICENSE](./LICENSE).

Kitchen.co and related marks remain the property of their respective owners.
