import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { logInfo, logWarn } from "./log";
import { KitchenProfile, mcpServerName } from "./profiles";
import {
  assertInsideDirectory,
  redactSecrets,
  sanitizeSlug,
  secureUnlink,
} from "./security";

type McpServerEntry = {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  envFile?: string;
  [key: string]: unknown;
};

type McpJson = {
  mcpServers?: Record<string, McpServerEntry>;
  [key: string]: unknown;
};

/** Marker so we only remove/update entries we own. Required for mutations. */
export const KITCHEN_MANAGED = "x-kitchen-mcp-managed";
export const KITCHEN_MANAGED_VALUE = "dimy-osman.kitchen-co-mcp";

export function userMcpJsonPath(): string {
  return path.join(os.homedir(), ".cursor", "mcp.json");
}

export function envVarNameForProfile(profile: KitchenProfile): string {
  const slug = sanitizeSlug(profile.name, profile.id);
  return `KITCHEN_${slug.replace(/-/g, "_").toUpperCase()}_API_KEY`;
}

export function profileEnvFilePath(
  globalStorageUri: vscode.Uri,
  profile: KitchenProfile
): string {
  const serverName = mcpServerName(profile);
  const envDir = path.join(globalStorageUri.fsPath, "env");
  fs.mkdirSync(envDir, { recursive: true });
  return assertInsideDirectory(
    path.join(envDir, `${serverName}.env`),
    envDir,
    "env file"
  );
}

function readMcpJson(filePath: string): McpJson {
  if (!fs.existsSync(filePath)) {
    return { mcpServers: {} };
  }
  const raw = fs.readFileSync(filePath, "utf8");
  if (!raw.trim()) {
    return { mcpServers: {} };
  }
  const parsed = JSON.parse(raw) as McpJson;
  if (
    !parsed.mcpServers ||
    typeof parsed.mcpServers !== "object" ||
    Array.isArray(parsed.mcpServers)
  ) {
    parsed.mcpServers = {};
  }
  return parsed;
}

function writeMcpJsonAtomic(filePath: string, data: McpJson): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });

  // Backup existing file once per write (keep last good copy)
  if (fs.existsSync(filePath)) {
    try {
      fs.copyFileSync(filePath, `${filePath}.kitchen-mcp.bak`);
    } catch {
      // non-fatal
    }
  }

  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  fs.renameSync(tmp, filePath);
}

export function durableEntryExists(serverName: string): boolean {
  try {
    const cfg = readMcpJson(userMcpJsonPath());
    const entry = cfg.mcpServers?.[serverName];
    return Boolean(entry && isKitchenManaged(entry));
  } catch {
    return false;
  }
}

/**
 * Materialize a short-lived env file for Cursor stdio spawn.
 * Prefer wiping these on deactivate; SecretStorage/vault remain source of truth.
 */
export function writeProfileEnvFile(
  globalStorageUri: vscode.Uri,
  profile: KitchenProfile,
  apiKey: string
): string {
  const filePath = profileEnvFilePath(globalStorageUri, profile);
  // Never log apiKey; validate no newline injection into env file
  const cleaned = apiKey.trim().replace(/[\r\n\0]/g, "");
  if (!cleaned) {
    throw new Error("Refusing to write empty API key");
  }
  const body = `# Managed by Kitchen.co MCP (Unofficial) — do not commit or share\nKITCHEN_API_KEY=${cleaned}\n`;
  const tmp = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, body, { encoding: "utf8", mode: 0o600 });
  fs.renameSync(tmp, filePath);
  try {
    fs.chmodSync(filePath, 0o600);
  } catch {
    // best-effort on Windows
  }
  return filePath;
}

export function deleteProfileEnvFile(
  globalStorageUri: vscode.Uri,
  serverNameOrProfile: KitchenProfile | string
): void {
  try {
    const envDir = path.join(globalStorageUri.fsPath, "env");
    const filePath =
      typeof serverNameOrProfile === "string"
        ? assertInsideDirectory(
            path.join(envDir, `${serverNameOrProfile}.env`),
            envDir,
            "env file"
          )
        : profileEnvFilePath(globalStorageUri, serverNameOrProfile);
    secureUnlink(filePath);
  } catch (err) {
    logWarn(
      `Could not delete env file: ${redactSecrets(
        err instanceof Error ? err.message : String(err)
      )}`
    );
  }
}

/** Securely wipe all materialized env files under globalStorage/env. */
export function wipeAllEnvFiles(globalStorageUri: vscode.Uri): void {
  const envDir = path.join(globalStorageUri.fsPath, "env");
  if (!fs.existsSync(envDir)) return;
  for (const name of fs.readdirSync(envDir)) {
    if (!name.endsWith(".env")) continue;
    try {
      secureUnlink(
        assertInsideDirectory(path.join(envDir, name), envDir, "env file")
      );
    } catch {
      // ignore
    }
  }
  logInfo("Wiped materialized API key env files from disk");
}

function isKitchenManaged(entry: McpServerEntry): boolean {
  const marker = entry[KITCHEN_MANAGED];
  return marker === KITCHEN_MANAGED_VALUE || marker === true;
}

function resolveMcpEntryScript(extensionPath: string): string {
  const entryPath = path.join(extensionPath, "mcp", "dist", "index.js");
  return assertInsideDirectory(entryPath, extensionPath, "MCP entry script");
}

/**
 * Upsert durable stdio MCP entry in ~/.cursor/mcp.json.
 * Only mutates entries tagged with our managed marker.
 */
export function upsertDurableMcpEntry(options: {
  extensionPath: string;
  globalStorageUri: vscode.Uri;
  profile: KitchenProfile;
  apiKey: string;
  previousServerName?: string;
  writeEnvFile: boolean;
}): { serverName: string; mcpJsonPath: string; envFile?: string } {
  const serverName = mcpServerName(options.profile);
  const mcpJsonPath = userMcpJsonPath();
  const entryPath = resolveMcpEntryScript(options.extensionPath);
  const nodeModules = assertInsideDirectory(
    path.join(options.extensionPath, "node_modules"),
    options.extensionPath,
    "node_modules"
  );

  let envFile: string | undefined;
  if (options.writeEnvFile) {
    envFile = writeProfileEnvFile(
      options.globalStorageUri,
      options.profile,
      options.apiKey
    );
  }

  const cfg = readMcpJson(mcpJsonPath);

  if (
    options.previousServerName &&
    options.previousServerName !== serverName &&
    cfg.mcpServers?.[options.previousServerName]
  ) {
    const prev = cfg.mcpServers[options.previousServerName];
    if (isKitchenManaged(prev)) {
      delete cfg.mcpServers[options.previousServerName];
      deleteProfileEnvFile(
        options.globalStorageUri,
        options.previousServerName
      );
      logInfo(`Removed old durable MCP entry: ${options.previousServerName}`);
    }
  }

  const existing = cfg.mcpServers?.[serverName];
  if (existing && !isKitchenManaged(existing)) {
    throw new Error(
      `Refusing to overwrite mcp.json entry "${serverName}" — not owned by this extension`
    );
  }

  cfg.mcpServers = cfg.mcpServers ?? {};
  const entry: McpServerEntry = {
    command: "node",
    args: [entryPath],
    env: {
      KITCHEN_BASE_URL: options.profile.baseUrl,
      KITCHEN_PROFILE_NAME: options.profile.name,
      NODE_PATH: nodeModules,
    },
    [KITCHEN_MANAGED]: KITCHEN_MANAGED_VALUE,
  };
  if (envFile) {
    entry.envFile = envFile;
  } else {
    // Document preferred secret injection without writing plaintext
    entry.env = {
      ...entry.env,
      KITCHEN_API_KEY: `\${env:${envVarNameForProfile(options.profile)}}`,
    };
  }

  cfg.mcpServers[serverName] = entry;
  writeMcpJsonAtomic(mcpJsonPath, cfg);
  logInfo(
    `Upserted durable MCP "${serverName}" (secrets via ${
      envFile ? "local envFile" : "OS env interpolation"
    })`
  );

  return { serverName, mcpJsonPath, envFile };
}

export function removeDurableMcpEntry(
  globalStorageUri: vscode.Uri,
  serverName: string
): boolean {
  const mcpJsonPath = userMcpJsonPath();
  if (!fs.existsSync(mcpJsonPath)) {
    deleteProfileEnvFile(globalStorageUri, serverName);
    return false;
  }

  const cfg = readMcpJson(mcpJsonPath);
  const entry = cfg.mcpServers?.[serverName];
  if (!entry) {
    deleteProfileEnvFile(globalStorageUri, serverName);
    return false;
  }

  if (!isKitchenManaged(entry)) {
    logWarn(
      `Refusing to remove mcp.json entry "${serverName}" — not Kitchen-managed`
    );
    return false;
  }

  delete cfg.mcpServers![serverName];
  writeMcpJsonAtomic(mcpJsonPath, cfg);
  deleteProfileEnvFile(globalStorageUri, serverName);
  logInfo(`Removed durable MCP entry: ${serverName}`);
  return true;
}
