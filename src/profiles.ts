import * as vscode from "vscode";
import { randomUUID } from "crypto";

export type KitchenProfile = {
  id: string;
  /** Display name, e.g. "Acme Client" */
  name: string;
  /** https://workspace.kitchen.co or workspace slug */
  baseUrl: string;
};

const PROFILES_KEY = "kitchenMcp.profiles";
const secretKey = (profileId: string) => `kitchenMcp.apiKey.${profileId}`;

export class ProfileStore {
  constructor(private readonly context: vscode.ExtensionContext) {}

  list(): KitchenProfile[] {
    return this.context.globalState.get<KitchenProfile[]>(PROFILES_KEY, []);
  }

  async getApiKey(profileId: string): Promise<string | undefined> {
    return this.context.secrets.get(secretKey(profileId));
  }

  async saveApiKey(profileId: string, apiKey: string): Promise<void> {
    await this.context.secrets.store(secretKey(profileId), apiKey.trim());
  }

  async deleteApiKey(profileId: string): Promise<void> {
    await this.context.secrets.delete(secretKey(profileId));
  }

  async upsert(profile: Omit<KitchenProfile, "id"> & { id?: string }, apiKey?: string): Promise<KitchenProfile> {
    const profiles = this.list();
    const id = profile.id ?? randomUUID();
    const next: KitchenProfile = {
      id,
      name: profile.name.trim(),
      baseUrl: normalizeBaseUrlInput(profile.baseUrl),
    };

    const idx = profiles.findIndex((p) => p.id === id);
    if (idx >= 0) {
      profiles[idx] = next;
    } else {
      profiles.push(next);
    }

    await this.context.globalState.update(PROFILES_KEY, profiles);

    if (apiKey !== undefined && apiKey.trim()) {
      await this.saveApiKey(id, apiKey);
    }

    return next;
  }

  async remove(profileId: string): Promise<void> {
    const profiles = this.list().filter((p) => p.id !== profileId);
    await this.context.globalState.update(PROFILES_KEY, profiles);
    await this.deleteApiKey(profileId);
  }

  findById(id: string): KitchenProfile | undefined {
    return this.list().find((p) => p.id === id);
  }
}

export function normalizeBaseUrlInput(input: string): string {
  let value = input.trim().replace(/\/+$/, "");
  if (!value) return value;

  // Bare workspace slug → full host
  if (!/^https?:\/\//i.test(value) && !value.includes(".")) {
    value = `https://${value}.kitchen.co`;
  } else if (!/^https?:\/\//i.test(value)) {
    value = `https://${value}`;
  }

  return value.replace(/\/api$/i, "");
}

export function mcpServerName(profile: KitchenProfile): string {
  const slug = profile.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `kitchen-${slug || profile.id.slice(0, 8)}`;
}

export async function promptForProfile(
  existing?: KitchenProfile,
  options?: { requireApiKey?: boolean }
): Promise<{ profile: Omit<KitchenProfile, "id"> & { id?: string }; apiKey?: string } | undefined> {
  const name = await vscode.window.showInputBox({
    title: existing
      ? "Edit Kitchen profile (unofficial MCP)"
      : "Add Kitchen profile (unofficial MCP)",
    prompt:
      "Profile name shown in Cursor MCP list. Unofficial extension — use your own Kitchen workspace.",
    value: existing?.name ?? "",
    placeHolder: "e.g. Acme Agency",
    ignoreFocusOut: true,
    validateInput: (v) => (!v.trim() ? "Name is required" : undefined),
  });
  if (name === undefined) return undefined;

  const baseUrl = await vscode.window.showInputBox({
    title: existing
      ? "Edit Kitchen profile (unofficial MCP)"
      : "Add Kitchen profile (unofficial MCP)",
    prompt: "Your Kitchen workspace URL or slug (e.g. acme or https://acme.kitchen.co)",
    value: existing?.baseUrl ?? "",
    placeHolder: "https://your-workspace.kitchen.co",
    ignoreFocusOut: true,
    validateInput: (v) => (!v.trim() ? "Base URL is required" : undefined),
  });
  if (baseUrl === undefined) return undefined;

  const apiKey = await vscode.window.showInputBox({
    title: existing
      ? "Edit Kitchen profile (unofficial MCP)"
      : "Add Kitchen profile (unofficial MCP)",
    prompt: existing
      ? "Your API token (leave blank to keep existing; stored in OS keychain — never shared with Kitchen.co as part of this extension)"
      : "Your API token from Kitchen Settings → Developer → API Token (stored locally only)",
    password: true,
    ignoreFocusOut: true,
    placeHolder: "Bearer token value only (not the word Bearer)",
    validateInput: (v) => {
      if (options?.requireApiKey !== false && !existing && !v.trim()) {
        return "API token is required for new profiles";
      }
      return undefined;
    },
  });
  if (apiKey === undefined) return undefined;

  return {
    profile: {
      id: existing?.id,
      name,
      baseUrl,
    },
    apiKey: apiKey.trim() ? apiKey : undefined,
  };
}
