# Security Policy

## Overview

**Kitchen.co MCP (Unofficial)** is a third-party Cursor/VS Code extension. It stores your Kitchen API tokens locally and lets AI agents call the Kitchen HTTP API.

This is **not** an official Kitchen.co product.

## How secrets are stored

| Secret | Storage |
|--------|---------|
| API token | VS Code/Cursor **SecretStorage** (OS keychain) — primary |
| API token backup | **AES-256-GCM encrypted vault** under extension `globalStorage` (master key in SecretStorage) |
| Short-lived env files | Optional `globalStorage/env/*.env` for Cursor durable MCP spawn (mode `0600`, wiped on deactivate by default) |
| `~/.cursor/mcp.json` | **Never** contains plaintext API keys |

## Protections

- HTTPS-only workspace URLs; blocks localhost / private / cloud-metadata hosts (SSRF)
- `kitchen_request` cannot call absolute URLs on other hosts; redirects disabled
- MCP script paths must stay inside the extension install directory
- `mcp.json` mutations only for entries tagged as owned by this extension
- Atomic `mcp.json` writes with `.kitchen-mcp.bak` backup
- Secrets redacted from Output logs and error toasts
- Profile IDs must be UUIDs; names/slugs sanitized (no path traversal)
- First-run unofficial/legal acknowledgment

## Settings that affect security

- `kitchenMcp.writePlaintextEnvFile` (default `true`) — required for durable MCP after reload in Cursor; disable for maximum hardness (use OS env `${env:…}` instead)
- `kitchenMcp.wipeEnvFilesOnDeactivate` (default `true`) — overwrite+delete env files when the extension host stops
- `kitchenMcp.persistToUserMcpJson` (default `true`) — merge durable MCP entries

## Reporting a vulnerability

Please open a **private** security report via GitHub Security Advisories on [dimy-osman/kitchen-co-mcp](https://github.com/dimy-osman/kitchen-co-mcp) or email the maintainer listed on the repo. Do not file public issues with live tokens or exploit PoCs that expose user data.

## What we do not claim

No software is “hack-proof.” This project follows practical hardening for a local MCP bridge. You remain responsible for token rotation, agent permissions, and workspace trust.
