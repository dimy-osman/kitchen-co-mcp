import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { logInfo, logWarn } from "./log";
import { KitchenProfile, mcpServerName } from "./profiles";
import {
  assertInsideDirectory,
  redactSecrets,
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

export const KITCHEN_MANAGED = "x-kitchen-mcp-managed";
export const KITCHEN_MANAGED_VALUE = "dimy-osman.kitchen-co-mcp";

export function userMcpJsonPath(): string {
  return path.join(os.homedir(), ".cursor", "mcp.json");
}

function profileEnvFilePath(
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isReplaceLockError(err: unknown): boolean {
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as NodeJS.ErrnoException).code)
      : "";
  return code === "EPERM" || code === "EACCES" || code === "EBUSY";
}

function unlinkQuiet(filePath: string): void {
  try {
    fs.unlinkSync(filePath);
  } catch {
    // leftover tmp is harmless
  }
}

function readTextIfExists(filePath: string): string | undefined {
  try {
    if (!fs.existsSync(filePath)) return undefined;
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return undefined;
  }
}

/**
 * Write text, skipping I/O when the file already matches.
 * Windows cannot rename over a dest that Cursor (or Defender) has open,
 * so fall back to in-place overwrite after a short retry.
 */
async function replaceTextFile(
  filePath: string,
  body: string,
  options?: { mode?: number }
): Promise<void> {
  if (readTextIfExists(filePath) === body) {
    return;
  }

  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, body, {
    encoding: "utf8",
    ...(options?.mode !== undefined ? { mode: options.mode } : {}),
  });

  let renamed = false;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      fs.renameSync(tmp, filePath);
      renamed = true;
      lastErr = undefined;
      break;
    } catch (err) {
      lastErr = err;
      if (!isReplaceLockError(err)) {
        unlinkQuiet(tmp);
        throw err;
      }
      await sleep(40 * 2 ** attempt);
    }
  }

  if (!renamed) {
    try {
      fs.writeFileSync(filePath, body, {
        encoding: "utf8",
        ...(options?.mode !== undefined ? { mode: options.mode } : {}),
      });
    } catch (writeErr) {
      unlinkQuiet(tmp);
      const detail = writeErr instanceof Error ? writeErr.message : String(writeErr);
      const prior = lastErr instanceof Error ? lastErr.message : String(lastErr);
      throw new Error(
        `${detail} (rename: ${prior}). Windows has this file locked (often Cursor holding the MCP envFile). Retry Re-register, or reload the window after the Kitchen MCP server disconnects.`
      );
    }
    unlinkQuiet(tmp);
  }

  if (options?.mode !== undefined) {
    try {
      fs.chmodSync(filePath, options.mode);
    } catch {
      // Windows best-effort
    }
  }
}

async function writeMcpJsonAtomic(filePath: string, data: McpJson): Promise<void> {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });

  const nextBody = `${JSON.stringify(data, null, 2)}\n`;
  if (readTextIfExists(filePath) === nextBody) {
    return;
  }

  if (fs.existsSync(filePath)) {
    try {
      fs.copyFileSync(filePath, `${filePath}.kitchen-mcp.bak`);
    } catch {
      // non-fatal
    }
  }

  await replaceTextFile(filePath, nextBody);
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

async function writeProfileEnvFile(
  globalStorageUri: vscode.Uri,
  profile: KitchenProfile,
  apiKey: string
): Promise<string> {
  const filePath = profileEnvFilePath(globalStorageUri, profile);
  const cleaned = apiKey.trim().replace(/[\r\n\0]/g, "");
  if (!cleaned) {
    throw new Error("Refusing to write empty API key");
  }
  const body = `# Managed by Kitchen.co MCP (Unofficial). Do not commit or share\nKITCHEN_API_KEY=${cleaned}\n`;
  await replaceTextFile(filePath, body, { mode: 0o600 });
  return filePath;
}

function deleteProfileEnvFile(
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

function isKitchenManaged(entry: McpServerEntry): boolean {
  const marker = entry[KITCHEN_MANAGED];
  return marker === KITCHEN_MANAGED_VALUE || marker === true;
}

function resolveMcpEntryScript(extensionPath: string): string {
  const entryPath = path.join(extensionPath, "mcp", "dist", "index.js");
  return assertInsideDirectory(entryPath, extensionPath, "MCP entry script");
}

function managedEntryMatches(
  existing: McpServerEntry | undefined,
  next: McpServerEntry
): boolean {
  if (!existing || !isKitchenManaged(existing)) return false;
  return (
    existing.command === next.command &&
    JSON.stringify(existing.args ?? []) === JSON.stringify(next.args ?? []) &&
    JSON.stringify(existing.env ?? {}) === JSON.stringify(next.env ?? {}) &&
    existing.envFile === next.envFile
  );
}

export async function upsertDurableMcpEntry(options: {
  extensionPath: string;
  globalStorageUri: vscode.Uri;
  profile: KitchenProfile;
  apiKey: string;
  previousServerName?: string;
}): Promise<{ serverName: string; mcpJsonPath: string; envFile: string }> {
  const serverName = mcpServerName(options.profile);
  const mcpJsonPath = userMcpJsonPath();
  const entryPath = resolveMcpEntryScript(options.extensionPath);
  const nodeModules = assertInsideDirectory(
    path.join(options.extensionPath, "node_modules"),
    options.extensionPath,
    "node_modules"
  );

  const envFile = await writeProfileEnvFile(
    options.globalStorageUri,
    options.profile,
    options.apiKey
  );

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
      logInfo(`Removed old MCP entry: ${options.previousServerName}`);
    }
  }

  const existing = cfg.mcpServers?.[serverName];
  if (existing && !isKitchenManaged(existing)) {
    throw new Error(
      `Refusing to overwrite mcp.json entry "${serverName}" — not owned by this extension`
    );
  }

  const nextEntry: McpServerEntry = {
    command: "node",
    args: [entryPath],
    env: {
      KITCHEN_BASE_URL: options.profile.baseUrl,
      KITCHEN_WORKSPACE: options.profile.name,
      KITCHEN_PROFILE_NAME: options.profile.name,
      NODE_PATH: nodeModules,
    },
    envFile,
    [KITCHEN_MANAGED]: KITCHEN_MANAGED_VALUE,
  };

  cfg.mcpServers = cfg.mcpServers ?? {};
  if (managedEntryMatches(existing, nextEntry)) {
    logInfo(`MCP "${serverName}" already current; skipped mcp.json write`);
    return { serverName, mcpJsonPath, envFile };
  }

  cfg.mcpServers[serverName] = nextEntry;

  await writeMcpJsonAtomic(mcpJsonPath, cfg);
  logInfo(`Upserted MCP "${serverName}"`);

  return { serverName, mcpJsonPath, envFile };
}

export async function removeDurableMcpEntry(
  globalStorageUri: vscode.Uri,
  serverName: string
): Promise<boolean> {
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
  await writeMcpJsonAtomic(mcpJsonPath, cfg);
  deleteProfileEnvFile(globalStorageUri, serverName);
  logInfo(`Removed MCP entry: ${serverName}`);
  return true;
}
