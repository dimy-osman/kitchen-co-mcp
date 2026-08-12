# Bug report: Kitchen MCP disappears after Cursor window reload

**Project:** Kitchen.co MCP (`dimy-osman/kitchen-co-mcp`, KTCH-MCP)  
**Version:** `0.1.0` (VSIX installed in Cursor)  
**Environment:** Cursor 3.14.x / VS Code 1.128.x, Windows 10  
**Date observed:** 2026-08-12  
**Severity:** High — agents lose Kitchen tools after a normal reload; users think the integration is broken

---

## Summary

After installing the extension, adding a profile, and seeing a successful MCP stdio connect (`kitchen-web-dimyosman-com`), a Cursor **window reload** causes Kitchen to vanish from:

- Cursor Settings → MCP
- Agent-available MCP servers (`GetMcpTools` / tool catalog)

The extension package remains installed. Kitchen is not listed in `~/.cursor/mcp.json` because registration is dynamic only. After reload, agents cannot call `kitchen_*` tools until the user manually re-adds / re-registers.

---

## Reproduction

1. Install `kitchen-co-mcp-0.1.0.vsix` in Cursor.
2. Command Palette → **Kitchen.co MCP: Add Profile** (name + base URL + API token).
3. Confirm MCP appears (e.g. `extension-kitchen-web-dimyosman-com`) and logs show stdio connect success.
4. Reload Cursor window (Developer: Reload Window), or fully restart Cursor.
5. Open MCP settings / start a new agent chat.

**Expected:** Kitchen MCP server(s) still registered and available to agents.  
**Actual:** Kitchen is gone from MCP list and agent tool catalog. Extension still present under Extensions.

---

## Evidence

### Successful connect (before reload)

Log: `%APPDATA%\Cursor\logs\...\mcp-server-user-dimy-osman.kitchen-co-mcp-extension-kitchen-web-dimyosman-com.log`

```text
connecting stdio for "extension-kitchen-web-dimyosman-com"
Successfully connected to stdio server
connection:connect_success
```

Extension activation also succeeded:

```text
ExtensionService#_doActivateExtension dimy-osman.kitchen-co-mcp
Extension activated success: dimy-osman.kitchen-co-mcp
```

### After reload

Agent MCP catalog no longer includes any `kitchen*` / `dimy-osman.kitchen*` server. Available servers were only static `mcp.json` entries (Brave, Composio, Hostinger, etc.) plus other plugins — not Kitchen.

`~/.cursor/mcp.json` never contained a Kitchen entry (by design of the extension registration path).

---

## Root cause (code)

### 1. `deactivate()` always unregisters MCP servers

`src/extension.ts` (compiled `out/extension.js`):

```ts
function deactivate() {
  void registrar?.unregisterAll();
}
```

Window reload / extension host restart calls `deactivate`, which removes every registered Kitchen server from Cursor’s MCP registry **before** the next activation has finished (or succeeds).

### 2. Re-register on activate is best-effort and easy to miss

On activate, re-register only runs if:

- `kitchenMcp.autoRegister === true`, and
- `store.list().length > 0`, and
- each profile has an API key in `SecretStorage`

```ts
if (auto && store.list().length > 0) {
  await reregister(false); // showMessage = false → silent failures
}
```

Problems:

- Failures during silent `reregister(false)` are **not shown** to the user.
- If `getCursorMcpApi()` is temporarily unavailable during early activate, registration is skipped with only an error string returned (easy to miss).
- If profile list is empty or SecretStorage key is missing after restart, nothing is registered and the user may only see a one-shot “Add Profile” toast (easy to dismiss / miss).
- Race: unregister on deactivate + delayed / failed re-register on activate leaves a gap where MCP permanently disappears until manual **Re-register**.

### 3. Registration is not durable

`McpRegistrar` uses only `vscode.cursor.mcp.registerServer` (in-memory / session registration). It does **not** write a durable Cursor user MCP config entry (the same shape as `~/.cursor/mcp.json`).

Cursor’s own durable MCP configs (user `mcp.json`) survive reloads. Extension-registered servers that are unregistered on deactivate do not.

### 4. Related observation

`globalStorage\dimy-osman.kitchen-co-mcp` was not present on disk when inspected after disappearance, which may indicate profile state / SecretStorage timing issues across reloads, or Cursor storage layout differences — worth verifying that `kitchenMcp.profiles` persists across reload.

---

## What should be done (recommendations)

### P0 — Stop unregistering on normal deactivate (or make it safe)

Do **not** call `unregisterAll()` unconditionally in `deactivate()` for window reload.

Options:

1. **Preferred:** Never unregister on deactivate. Register idempotently on activate (`unregister` only the names you are about to replace, or rely on Cursor replacing same-name servers).
2. Or: unregister only on explicit **Remove Profile** / extension uninstall, not on host shutdown.
3. If Cursor requires cleanup on deactivate, re-register in `activate` with retries + user-visible error if `registerServer` fails.

### P0 — Durable registration via native Cursor MCP config

Mirror how other MCP servers are configured in Cursor (`~/.cursor/mcp.json` / Cursor Settings → MCP):

On **Add Profile** / **Edit Profile** / **Re-register**, upsert a durable MCP server entry, e.g.:

```json
{
  "mcpServers": {
    "kitchen-web-dimyosman-com": {
      "command": "node",
      "args": ["<extensionPath>/mcp/dist/index.js"],
      "env": {
        "KITCHEN_BASE_URL": "https://web.dimyosman.com",
        "KITCHEN_API_KEY": "${env:KITCHEN_WEB_DIMYOSMAN_COM_KEY}",
        "KITCHEN_PROFILE_NAME": "web-dimyosman-com",
        "NODE_PATH": "<extensionPath>/node_modules"
      }
    }
  }
}
```

Guidelines:

- Prefer Cursor’s supported MCP config API if available; otherwise document + manage `~/.cursor/mcp.json` carefully (merge, never clobber other servers).
- Keep secrets out of the JSON file: use `${env:VAR}` (native Cursor env interpolation), same pattern as the extension README’s “Standalone MCP” section.
- On Add Profile: create/update the env var name suggestion; optionally open instructions to set User env var, or use SecretStorage **and** inject at process spawn only if staying on `registerServer`.
- On Remove Profile: remove the durable entry.

This is the path that “survives reloads” the way Brave/Composio/Hostinger entries do.

### P1 — Make activate registration reliable and visible

- Retry `getCursorMcpApi()` / `registerServer` for a few seconds after activate (API may not be ready at `onStartupFinished`).
- Always surface failures: toast + Output channel `Kitchen.co MCP` with registration result (`ok` / `skipped` / errors), even for auto-register.
- Command **Re-register MCP Servers** should remain, but users should not need it after every reload.
- **List Profiles** should show “registered in Cursor MCP: yes/no” and “durable mcp.json: yes/no”.

### P1 — Health check after reload

On activate, after register:

1. Confirm server name appears (if Cursor exposes a list API), or
2. Spawn a short `kitchen_whoami` probe / document Test Connection as post-reload verification.

### P2 — Docs / UX

- README: warn that v0.1.0 dynamic-only registration can disappear on reload until P0 fix.
- After Add Profile: show “If Kitchen vanishes after reload, run Re-register” as temporary mitigation.
- Prefer durable config as the default story for Cursor agents.

---

## Suggested acceptance criteria

- [ ] Add profile → Kitchen tools available in a new Agent chat.
- [ ] Developer: Reload Window → Kitchen still listed under Cursor MCP without running Re-register.
- [ ] Fully quit and reopen Cursor → Kitchen still available.
- [ ] Remove profile → durable MCP entry removed; tools gone.
- [ ] API key never written in plaintext into `mcp.json` or git.
- [ ] Registration failures always visible in UI/Output.

---

## Temporary user workaround (until fixed)

1. Command Palette → **Kitchen.co MCP: List Profiles** / **Add Profile** if empty.  
2. **Kitchen.co MCP: Re-register MCP Servers**.  
3. Or manually add a durable `~/.cursor/mcp.json` entry using `${env:KITCHEN_API_KEY}` as in README “Standalone MCP”.

---

## References

| Item | Location |
|------|----------|
| Unregister on deactivate | `src/extension.ts` → `deactivate()` |
| Register loop | `src/mcp-registrar.ts` → `registerAll()` / `registerProfile()` |
| Cursor MCP API helper | `src/cursor-mcp.ts` → `getCursorMcpApi()` |
| Standalone durable example | `README.md` → “Standalone MCP (without extension UI)” |
| Cursor MCP docs | https://cursor.com/docs (MCP / extension MCP registration) |

---

## Reporter notes

Observed while using Cursor Agent against Maruca project workspace; Kitchen profile name corresponded to `web.dimyosman.com` / `kitchen-web-dimyosman-com`. Issue is independent of Kitchen API data — it is registration lifecycle with Cursor reload.
