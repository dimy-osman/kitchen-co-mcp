# Changelog

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
