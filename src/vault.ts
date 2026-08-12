import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { logInfo, logWarn } from "./log";
import { assertInsideDirectory, secureUnlink } from "./security";

const MASTER_KEY_SECRET = "kitchenMcp.vault.masterKey.v1";
const VAULT_FILENAME = "credentials.vault.json";

type VaultFile = {
  v: 1;
  /** profileId → base64 ciphertext blob */
  profiles: Record<string, string>;
};

/**
 * AES-256-GCM vault for API keys at rest.
 * Master key lives in SecretStorage (OS keychain) — never in the vault file.
 */
export class CredentialVault {
  constructor(private readonly context: vscode.ExtensionContext) {}

  private vaultPath(): string {
    const dir = this.context.globalStorageUri.fsPath;
    fs.mkdirSync(dir, { recursive: true });
    return assertInsideDirectory(
      path.join(dir, VAULT_FILENAME),
      dir,
      "vault path"
    );
  }

  private async getMasterKey(): Promise<Buffer> {
    let b64 = await this.context.secrets.get(MASTER_KEY_SECRET);
    if (!b64) {
      const key = randomBytes(32);
      b64 = key.toString("base64");
      await this.context.secrets.store(MASTER_KEY_SECRET, b64);
      logInfo("Created new credential vault master key in SecretStorage");
      return key;
    }
    const key = Buffer.from(b64, "base64");
    if (key.length !== 32) {
      throw new Error("Invalid vault master key length");
    }
    return key;
  }

  private readVault(): VaultFile {
    const file = this.vaultPath();
    if (!fs.existsSync(file)) {
      return { v: 1, profiles: {} };
    }
    const raw = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(raw) as VaultFile;
    if (parsed.v !== 1 || typeof parsed.profiles !== "object" || !parsed.profiles) {
      throw new Error("Corrupt credential vault");
    }
    return parsed;
  }

  private writeVault(vault: VaultFile): void {
    const file = this.vaultPath();
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(vault)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    fs.renameSync(tmp, file);
    try {
      fs.chmodSync(file, 0o600);
    } catch {
      // Windows best-effort
    }
  }

  private encrypt(apiKey: string, master: Buffer): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", master, iv);
    const enc = Buffer.concat([
      cipher.update(apiKey, "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString("base64");
  }

  private decrypt(blobB64: string, master: Buffer): string {
    const buf = Buffer.from(blobB64, "base64");
    if (buf.length < 12 + 16 + 1) {
      throw new Error("Invalid ciphertext");
    }
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", master, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString(
      "utf8"
    );
  }

  async setApiKey(profileId: string, apiKey: string): Promise<void> {
    const master = await this.getMasterKey();
    const vault = this.readVault();
    vault.profiles[profileId] = this.encrypt(apiKey.trim(), master);
    this.writeVault(vault);
  }

  async getApiKey(profileId: string): Promise<string | undefined> {
    const vault = this.readVault();
    const blob = vault.profiles[profileId];
    if (!blob) return undefined;
    const master = await this.getMasterKey();
    try {
      return this.decrypt(blob, master);
    } catch {
      logWarn("Failed to decrypt vault entry — re-add the API key");
      return undefined;
    }
  }

  async deleteApiKey(profileId: string): Promise<void> {
    const vault = this.readVault();
    if (!(profileId in vault.profiles)) return;
    delete vault.profiles[profileId];
    this.writeVault(vault);
  }

  /** Destroy vault file (keys remain only in SecretStorage mirror if any). */
  destroyVaultFile(): void {
    secureUnlink(this.vaultPath());
  }
}
