import * as vscode from "vscode";
import { randomUUID } from "crypto";
import {
  sanitizeProfileId,
  sanitizeSlug,
  validateAndNormalizeBaseUrl,
} from "./security";
import { CredentialVault } from "./vault";

export type KitchenProfile = {
  id: string;
  /** Display name, e.g. "Acme Client" */
  name: string;
  /** https://workspace.kitchen.co or custom https host */
  baseUrl: string;
};

const PROFILES_KEY = "kitchenMcp.profiles";
const secretKey = (profileId: string) => `kitchenMcp.apiKey.${profileId}`;

export class ProfileStore {
  private readonly vault: CredentialVault;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.vault = new CredentialVault(context);
  }

  list(): KitchenProfile[] {
    const raw = this.context.globalState.get<KitchenProfile[]>(PROFILES_KEY, []);
    return raw.filter(
      (p) =>
        p &&
        typeof p.id === "string" &&
        sanitizeProfileId(p.id) &&
        typeof p.name === "string" &&
        typeof p.baseUrl === "string"
    );
  }

  async getApiKey(profileId: string): Promise<string | undefined> {
    if (!sanitizeProfileId(profileId)) return undefined;
    // Prefer OS keychain SecretStorage; fall back to encrypted vault
    const fromSecrets = await this.context.secrets.get(secretKey(profileId));
    if (fromSecrets) return fromSecrets;
    return this.vault.getApiKey(profileId);
  }

  async saveApiKey(profileId: string, apiKey: string): Promise<void> {
    if (!sanitizeProfileId(profileId)) {
      throw new Error("Invalid profile id");
    }
    const cleaned = apiKey.trim().replace(/[\r\n\0]/g, "");
    if (!cleaned) {
      throw new Error("API key is empty");
    }
    if (cleaned.length > 8192) {
      throw new Error("API key is unreasonably long");
    }
    await this.context.secrets.store(secretKey(profileId), cleaned);
    // Encrypted disk backup so durable env files can be rematerialized after wipe
    await this.vault.setApiKey(profileId, cleaned);
  }

  async deleteApiKey(profileId: string): Promise<void> {
    if (!sanitizeProfileId(profileId)) return;
    await this.context.secrets.delete(secretKey(profileId));
    await this.vault.deleteApiKey(profileId);
  }

  async upsert(
    profile: Omit<KitchenProfile, "id"> & { id?: string },
    apiKey?: string
  ): Promise<KitchenProfile> {
    const profiles = this.list();
    const id = profile.id ?? randomUUID();
    if (!sanitizeProfileId(id)) {
      throw new Error("Invalid profile id");
    }

    const url = validateAndNormalizeBaseUrl(profile.baseUrl);
    if (!url.ok) {
      throw new Error(url.error);
    }

    const name = profile.name.trim().slice(0, 80);
    if (!name) {
      throw new Error("Profile name is required");
    }

    const next: KitchenProfile = {
      id,
      name,
      baseUrl: url.url,
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
  const result = validateAndNormalizeBaseUrl(input);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.url;
}

export function mcpServerName(profile: KitchenProfile): string {
  const slug = sanitizeSlug(profile.name, profile.id);
  return `kitchen-${slug}`;
}

export async function promptForProfile(
  existing?: KitchenProfile,
  options?: { requireApiKey?: boolean }
): Promise<
  | { profile: Omit<KitchenProfile, "id"> & { id?: string }; apiKey?: string }
  | undefined
> {
  const name = await vscode.window.showInputBox({
    title: existing
      ? "Edit Kitchen profile (unofficial MCP)"
      : "Add Kitchen profile (unofficial MCP)",
    prompt:
      "Profile name shown in Cursor MCP list. Unofficial extension — use your own Kitchen workspace.",
    value: existing?.name ?? "",
    placeHolder: "e.g. Acme Agency",
    ignoreFocusOut: true,
    validateInput: (v) => {
      if (!v.trim()) return "Name is required";
      if (v.trim().length > 80) return "Name is too long";
      return undefined;
    },
  });
  if (name === undefined) return undefined;

  const baseUrl = await vscode.window.showInputBox({
    title: existing
      ? "Edit Kitchen profile (unofficial MCP)"
      : "Add Kitchen profile (unofficial MCP)",
    prompt:
      "Your Kitchen workspace URL or slug (https only; e.g. acme or https://acme.kitchen.co)",
    value: existing?.baseUrl ?? "",
    placeHolder: "https://your-workspace.kitchen.co",
    ignoreFocusOut: true,
    validateInput: (v) => {
      const result = validateAndNormalizeBaseUrl(v);
      return result.ok ? undefined : result.error;
    },
  });
  if (baseUrl === undefined) return undefined;

  const apiKey = await vscode.window.showInputBox({
    title: existing
      ? "Edit Kitchen profile (unofficial MCP)"
      : "Add Kitchen profile (unofficial MCP)",
    prompt: existing
      ? "Your API token (leave blank to keep existing; OS keychain + encrypted vault)"
      : "Your API token from Kitchen Settings → Developer → API Token (stored locally only)",
    password: true,
    ignoreFocusOut: true,
    placeHolder: "Bearer token value only (not the word Bearer)",
    validateInput: (v) => {
      if (options?.requireApiKey !== false && !existing && !v.trim()) {
        return "API token is required for new profiles";
      }
      if (v && v.length > 8192) return "Token is too long";
      if (v && /[\r\n]/.test(v)) return "Token must not contain line breaks";
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
