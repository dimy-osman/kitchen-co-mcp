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
import { assertInsideDirectory, redactSecrets } from "./security";

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
  private registered = new Set<string>();

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly store: ProfileStore
  ) {}

  private mcpEntryPath(): string {
    return assertInsideDirectory(
      path.join(this.context.extensionPath, "mcp", "dist", "index.js"),
      this.context.extensionPath,
      "MCP entry"
    );
  }

  isDynamicallyRegistered(serverName: string): boolean {
    return this.registered.has(serverName);
  }

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

    const writeEnvFile = vscode.workspace
      .getConfiguration("kitchenMcp")
      .get<boolean>("writePlaintextEnvFile", true);

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
        const msg = `Profile "${profile.name}" has no API key — re-add the key.`;
        errors.push(msg);
        logError(msg);
        continue;
      }

      const previousServerName = options?.previousNames?.get(profile.id);

      if (persist) {
        try {
          upsertDurableMcpEntry({
            extensionPath: this.context.extensionPath,
            globalStorageUri: this.context.globalStorageUri,
            profile,
            apiKey,
            previousServerName,
            writeEnvFile,
          });
          durableOk += 1;
        } catch (err) {
          const msg = `Durable mcp.json sync failed for "${profile.name}": ${redactSecrets(
            err instanceof Error ? err.message : String(err),
            [apiKey]
          )}`;
          errors.push(msg);
          logError(msg);
        }
      }

      if (api) {
        const dyn = await this.registerDynamic(profile, apiKey, api);
        if (dyn === "ok") {
          dynamicOk += 1;
        } else if (dyn !== "skipped") {
          logWarn(redactSecrets(dyn, [apiKey]));
          if (!persist) {
            errors.push(redactSecrets(dyn, [apiKey]));
          }
        }
      }

      if (persist || api) {
        ok += 1;
        logInfo(
          `Profile "${profile.name}" → ${name} (durable=${
            persist && durableEntryExists(name)
          }, dynamic=${this.registered.has(name)})`
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
      try {
        api.unregisterServer(name);
      } catch {
        // ignore
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
            NODE_PATH: assertInsideDirectory(
              path.join(this.context.extensionPath, "node_modules"),
              this.context.extensionPath,
              "node_modules"
            ),
          },
        },
      });
      this.registered.add(name);
      return "ok";
    } catch (err) {
      return `Dynamic register failed for "${profile.name}": ${redactSecrets(
        err instanceof Error ? err.message : String(err),
        [apiKey]
      )}`;
    }
  }
}
