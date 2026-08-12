import * as path from "path";
import * as vscode from "vscode";
import { getCursorMcpApi, CursorMcpApi } from "./cursor-mcp";
import {
  durableEntryExists,
  removeDurableMcpEntry,
  upsertDurableMcpEntry,
  userMcpJsonPath,
} from "./durable-mcp";
import { logError, logInfo, logWarn } from "./log";
import { KitchenProfile, ProfileStore, mcpServerName } from "./profiles";

export type RegisterAllResult = {
  ok: number;
  skipped: number;
  errors: string[];
  durableOk: number;
  dynamicOk: number;
  apiReady: boolean;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class McpRegistrar {
  /** Names successfully registered via Cursor extension API this session. */
  private registered = new Set<string>();

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly store: ProfileStore
  ) {}

  private mcpEntryPath(): string {
    return path.join(this.context.extensionPath, "mcp", "dist", "index.js");
  }

  isDynamicallyRegistered(serverName: string): boolean {
    return this.registered.has(serverName);
  }

  /**
   * Unregister a single server (e.g. Remove Profile).
   * Do NOT call on deactivate — that caused MCP to vanish on reload (#1).
   */
  unregisterServer(serverName: string): void {
    const api = getCursorMcpApi();
    try {
      api?.unregisterServer(serverName);
    } catch {
      // ignore
    }
    this.registered.delete(serverName);
  }

  async waitForCursorMcpApi(
    attempts = 10,
    delayMs = 500
  ): Promise<CursorMcpApi | undefined> {
    for (let i = 0; i < attempts; i++) {
      const api = getCursorMcpApi();
      if (api) {
        if (i > 0) {
          logInfo(`Cursor MCP API ready after ${i + 1} attempt(s)`);
        }
        return api;
      }
      logInfo(
        `Cursor MCP API not ready (attempt ${i + 1}/${attempts}), retrying…`
      );
      await sleep(delayMs);
    }
    return undefined;
  }

  /**
   * Sync all profiles to durable ~/.cursor/mcp.json and (when available)
   * re-register via Cursor extension API. Idempotent.
   */
  async registerAll(options?: {
    previousNames?: Map<string, string>;
  }): Promise<RegisterAllResult> {
    const errors: string[] = [];
    let ok = 0;
    let skipped = 0;
    let durableOk = 0;
    let dynamicOk = 0;

    const persist = vscode.workspace
      .getConfiguration("kitchenMcp")
      .get<boolean>("persistToUserMcpJson", true);

    const api = await this.waitForCursorMcpApi();
    const apiReady = Boolean(api);

    if (!api) {
      logWarn(
        "Cursor MCP API not available after retries — durable mcp.json sync will still run if enabled."
      );
    }

    const profiles = this.store.list();
    if (profiles.length === 0) {
      logInfo("No profiles to register");
      return { ok: 0, skipped: 0, errors, durableOk, dynamicOk, apiReady };
    }

    for (const profile of profiles) {
      const name = mcpServerName(profile);
      const apiKey = await this.store.getApiKey(profile.id);
      if (!apiKey) {
        skipped += 1;
        const msg = `Profile "${profile.name}" has no API key in SecretStorage — re-add the key.`;
        errors.push(msg);
        logError(msg);
        continue;
      }

      const previousServerName = options?.previousNames?.get(profile.id);

      // P0: durable Cursor mcp.json (survives reload)
      if (persist) {
        try {
          upsertDurableMcpEntry({
            extensionPath: this.context.extensionPath,
            globalStorageUri: this.context.globalStorageUri,
            profile,
            apiKey,
            previousServerName,
          });
          durableOk += 1;
        } catch (err) {
          const msg = `Durable mcp.json sync failed for "${profile.name}": ${
            err instanceof Error ? err.message : String(err)
          }`;
          errors.push(msg);
          logError(msg);
        }
      }

      // Session registration (nice-to-have; durable config is the reload-safe path)
      if (api) {
        const dyn = await this.registerDynamic(profile, apiKey, api);
        if (dyn === "ok") {
          dynamicOk += 1;
        } else if (dyn !== "skipped") {
          // Durable success still counts as ok for the profile
          logWarn(dyn);
          if (!persist) {
            errors.push(dyn);
          }
        }
      }

      if (persist || api) {
        ok += 1;
        logInfo(
          `Profile "${profile.name}" → ${name} (durable=${persist && durableEntryExists(name)}, dynamic=${this.registered.has(name)})`
        );
      }
    }

    logInfo(
      `Register complete: profiles_ok=${ok} durable=${durableOk} dynamic=${dynamicOk} skipped=${skipped} errors=${errors.length} mcpJson=${userMcpJsonPath()}`
    );

    return { ok, skipped, errors, durableOk, dynamicOk, apiReady };
  }

  async removeProfileRegistration(profile: KitchenProfile): Promise<void> {
    const name = mcpServerName(profile);
    this.unregisterServer(name);
    removeDurableMcpEntry(this.context.globalStorageUri, name);
  }

  private async registerDynamic(
    profile: KitchenProfile,
    apiKey: string,
    api: CursorMcpApi
  ): Promise<"ok" | "skipped" | string> {
    const name = mcpServerName(profile);
    const entry = this.mcpEntryPath();

    try {
      // Replace same-name registration without a global unregisterAll
      try {
        api.unregisterServer(name);
      } catch {
        // ignore if not present
      }

      api.registerServer({
        name,
        server: {
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
      return `Dynamic register failed for "${profile.name}": ${
        err instanceof Error ? err.message : String(err)
      }`;
    }
  }
}
