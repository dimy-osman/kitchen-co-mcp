import * as vscode from "vscode";
import { getCursorMcpApi } from "./cursor-mcp";
import {
  durableEntryExists,
  removeDurableMcpEntry,
  upsertDurableMcpEntry,
  userMcpJsonPath,
} from "./durable-mcp";
import { logError, logInfo } from "./log";
import { KitchenProfile, ProfileStore, mcpServerName } from "./profiles";
import { redactSecrets } from "./security";

export type RegisterAllResult = {
  ok: number;
  skipped: number;
  errors: string[];
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class McpRegistrar {
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly store: ProfileStore
  ) {}

  unregisterServer(serverName: string): void {
    const api = getCursorMcpApi();
    try {
      api?.unregisterServer(serverName);
    } catch {
      // ignore leftover session servers from older versions
    }
  }

  private async waitForCursorMcpApi(
    attempts = 10,
    delayMs = 500
  ): Promise<ReturnType<typeof getCursorMcpApi>> {
    for (let i = 0; i < attempts; i++) {
      const api = getCursorMcpApi();
      if (api) return api;
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
    const names: string[] = [];

    const profiles = this.store.list();
    if (profiles.length === 0) {
      logInfo("No workspaces to sync");
      return { ok: 0, skipped: 0, errors };
    }

    for (const profile of profiles) {
      const name = mcpServerName(profile);
      const apiKey = await this.store.getApiKey(profile.id);
      if (!apiKey) {
        skipped += 1;
        const msg = `Workspace "${profile.name}" has no API key — re-add the key.`;
        errors.push(msg);
        logError(msg);
        continue;
      }

      names.push(name);
      try {
        upsertDurableMcpEntry({
          extensionPath: this.context.extensionPath,
          globalStorageUri: this.context.globalStorageUri,
          profile,
          apiKey,
          previousServerName: options?.previousNames?.get(profile.id),
        });
        ok += 1;
        logInfo(
          `Workspace "${profile.name}" → ${name} (mcp.json=${durableEntryExists(
            name
          )})`
        );
      } catch (err) {
        const msg = `mcp.json sync failed for "${profile.name}": ${redactSecrets(
          err instanceof Error ? err.message : String(err),
          [apiKey]
        )}`;
        errors.push(msg);
        logError(msg);
      }
    }

    const api = getCursorMcpApi() ?? (await this.waitForCursorMcpApi());
    if (api) {
      for (const name of names) {
        this.unregisterServer(name);
      }
    }

    logInfo(
      `Sync complete: ok=${ok} skipped=${skipped} errors=${errors.length} mcpJson=${userMcpJsonPath()}`
    );

    return { ok, skipped, errors };
  }

  async removeProfileRegistration(profile: KitchenProfile): Promise<void> {
    const name = mcpServerName(profile);
    this.unregisterServer(name);
    removeDurableMcpEntry(this.context.globalStorageUri, name);
  }
}
