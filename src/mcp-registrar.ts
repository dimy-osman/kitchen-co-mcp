import * as path from "path";
import * as vscode from "vscode";
import { getCursorMcpApi } from "./cursor-mcp";
import { KitchenProfile, ProfileStore, mcpServerName } from "./profiles";

export class McpRegistrar {
  private registered = new Set<string>();

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly store: ProfileStore
  ) {}

  private mcpEntryPath(): string {
    return path.join(this.context.extensionPath, "mcp", "dist", "index.js");
  }

  async unregisterAll(): Promise<void> {
    const api = getCursorMcpApi();
    for (const name of [...this.registered]) {
      try {
        api?.unregisterServer(name);
      } catch {
        // ignore
      }
      this.registered.delete(name);
    }

    // Also unregister by current profile names in case of restart mismatch
    for (const profile of this.store.list()) {
      const name = mcpServerName(profile);
      try {
        api?.unregisterServer(name);
      } catch {
        // ignore
      }
    }
  }

  async registerAll(): Promise<{ ok: number; skipped: number; errors: string[] }> {
    const api = getCursorMcpApi();
    const errors: string[] = [];
    let ok = 0;
    let skipped = 0;

    if (!api) {
      return {
        ok: 0,
        skipped: this.store.list().length,
        errors: [
          "Cursor MCP API not available. This extension registers MCP via vscode.cursor.mcp (Cursor IDE). You can still use the bundled server via mcp.json — see README.",
        ],
      };
    }

    await this.unregisterAll();

    for (const profile of this.store.list()) {
      const result = await this.registerProfile(profile, api);
      if (result === "ok") ok += 1;
      else if (result === "skipped") skipped += 1;
      else errors.push(result);
    }

    return { ok, skipped, errors };
  }

  private async registerProfile(
    profile: KitchenProfile,
    api: NonNullable<ReturnType<typeof getCursorMcpApi>>
  ): Promise<"ok" | "skipped" | string> {
    const apiKey = await this.store.getApiKey(profile.id);
    if (!apiKey) {
      return `Profile "${profile.name}" has no API key in SecretStorage — re-add the key.`;
    }

    const name = mcpServerName(profile);
    const entry = this.mcpEntryPath();

    try {
      api.registerServer({
        name,
        server: {
          // Must be "node" — process.execPath inside Cursor is Electron, not Node.
          command: "node",
          args: [entry],
          env: {
            KITCHEN_BASE_URL: profile.baseUrl,
            KITCHEN_API_KEY: apiKey,
            KITCHEN_PROFILE_NAME: profile.name,
            NODE_PATH: path.join(this.context.extensionPath, "node_modules"),
          },
        },
      });
      this.registered.add(name);
      return "ok";
    } catch (err) {
      return `Failed to register "${profile.name}": ${
        err instanceof Error ? err.message : String(err)
      }`;
    }
  }
}
