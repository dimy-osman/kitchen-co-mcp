import * as vscode from "vscode";
import {
  ACK_STORAGE_KEY,
  DISCLAIMER_BODY,
  DISCLAIMER_TITLE,
  UNOFFICIAL_ONE_LINER,
} from "./disclaimer";
import {
  durableEntryExists,
  envVarNameForProfile,
  userMcpJsonPath,
} from "./durable-mcp";
import { getLog, logError, logInfo } from "./log";
import { McpRegistrar } from "./mcp-registrar";
import {
  KitchenProfile,
  ProfileStore,
  mcpServerName,
  normalizeBaseUrlInput,
  promptForProfile,
} from "./profiles";

let store: ProfileStore;
let registrar: McpRegistrar;
let extensionContext: vscode.ExtensionContext;

export async function activate(
  context: vscode.ExtensionContext
): Promise<void> {
  extensionContext = context;
  store = new ProfileStore(context);
  registrar = new McpRegistrar(context, store);

  context.subscriptions.push(getLog());

  context.subscriptions.push(
    vscode.commands.registerCommand("kitchenMcp.about", () => showAbout()),
    vscode.commands.registerCommand("kitchenMcp.addProfile", () => addProfile()),
    vscode.commands.registerCommand("kitchenMcp.editProfile", () =>
      editProfile()
    ),
    vscode.commands.registerCommand("kitchenMcp.removeProfile", () =>
      removeProfile()
    ),
    vscode.commands.registerCommand("kitchenMcp.listProfiles", () =>
      listProfiles()
    ),
    vscode.commands.registerCommand("kitchenMcp.reregister", () =>
      reregister({ showMessage: true })
    ),
    vscode.commands.registerCommand("kitchenMcp.testConnection", () =>
      testConnection()
    ),
    vscode.commands.registerCommand("kitchenMcp.showLog", () => {
      getLog().show(true);
    })
  );

  logInfo(
    `Kitchen.co MCP (Unofficial) activate (${context.extension.packageJSON.version})`
  );
  logInfo(UNOFFICIAL_ONE_LINER);
  logInfo(`Profiles in globalState: ${store.list().length}`);
  logInfo(`User mcp.json: ${userMcpJsonPath()}`);

  const acknowledged = await ensureDisclaimerAcknowledged();
  if (!acknowledged) {
    logInfo("Disclaimer not acknowledged — skipping auto-register.");
    return;
  }

  const auto = vscode.workspace
    .getConfiguration("kitchenMcp")
    .get<boolean>("autoRegister", true);

  if (auto && store.list().length > 0) {
    await reregister({ showMessage: true, fromActivate: true });
  } else if (store.list().length === 0) {
    vscode.window
      .showInformationMessage(
        "Kitchen.co MCP (Unofficial): add your own workspace URL + API token to connect Cursor agents.",
        "Add Profile",
        "About"
      )
      .then((choice) => {
        if (choice === "Add Profile") {
          void vscode.commands.executeCommand("kitchenMcp.addProfile");
        } else if (choice === "About") {
          void vscode.commands.executeCommand("kitchenMcp.about");
        }
      });
  }
}

/**
 * P0 (#1): Do NOT unregister MCP servers on deactivate.
 */
export function deactivate(): void {
  logInfo(
    "deactivate: leaving MCP registrations intact (durable mcp.json + no unregister)"
  );
}

async function ensureDisclaimerAcknowledged(): Promise<boolean> {
  if (extensionContext.globalState.get<boolean>(ACK_STORAGE_KEY)) {
    return true;
  }

  const choice = await vscode.window.showInformationMessage(
    DISCLAIMER_TITLE,
    { modal: true, detail: DISCLAIMER_BODY },
    "I Understand — Continue",
    "Open About"
  );

  if (choice === "Open About") {
    await showAbout();
    const again = await vscode.window.showInformationMessage(
      "Continue with this unofficial Kitchen.co MCP extension?",
      { modal: true },
      "I Understand — Continue"
    );
    if (again !== "I Understand — Continue") {
      return false;
    }
  } else if (choice !== "I Understand — Continue") {
    return false;
  }

  await extensionContext.globalState.update(ACK_STORAGE_KEY, true);
  logInfo("User acknowledged unofficial / legal disclaimer");
  return true;
}

async function showAbout(): Promise<void> {
  const version = extensionContext.extension.packageJSON.version as string;
  const text = [
    DISCLAIMER_TITLE,
    `Version ${version} · KTCH-MCP · Dimy Osman`,
    "",
    DISCLAIMER_BODY,
  ].join("\n");

  logInfo("About / Disclaimer opened");
  getLog().appendLine("----- About / Disclaimer -----");
  getLog().appendLine(text);
  getLog().show(true);

  await vscode.window.showInformationMessage(text, { modal: true }, "OK");
}

async function addProfile(): Promise<void> {
  if (!(await ensureDisclaimerAcknowledged())) return;

  const result = await promptForProfile(undefined, { requireApiKey: true });
  if (!result) return;

  const profile = await store.upsert(result.profile, result.apiKey);
  await reregister({ showMessage: true });
  const name = mcpServerName(profile);
  vscode.window.showInformationMessage(
    `Kitchen.co MCP (Unofficial): added "${profile.name}" as "${name}". Your token stays in OS keychain + local envFile.`
  );
}

async function editProfile(): Promise<void> {
  const profile = await pickProfile("Edit profile");
  if (!profile) return;

  const previousName = mcpServerName(profile);
  const result = await promptForProfile(profile);
  if (!result) return;

  const updated = await store.upsert(result.profile, result.apiKey);
  const previousNames = new Map<string, string>([[updated.id, previousName]]);
  await reregister({ showMessage: true, previousNames });
  vscode.window.showInformationMessage(
    `Kitchen.co MCP: updated profile "${updated.name}".`
  );
}

async function removeProfile(): Promise<void> {
  const profile = await pickProfile("Remove profile");
  if (!profile) return;

  const confirm = await vscode.window.showWarningMessage(
    `Remove Kitchen profile "${profile.name}"? API key, envFile, and durable mcp.json entry will be deleted.`,
    { modal: true },
    "Remove"
  );
  if (confirm !== "Remove") return;

  await registrar.removeProfileRegistration(profile);
  await store.remove(profile.id);
  logInfo(`Removed profile "${profile.name}"`);
  vscode.window.showInformationMessage(
    `Kitchen.co MCP: removed profile "${profile.name}".`
  );
}

async function listProfiles(): Promise<void> {
  const profiles = store.list();
  if (profiles.length === 0) {
    vscode.window.showInformationMessage(
      "Kitchen.co MCP: no profiles configured."
    );
    return;
  }

  const lines = await Promise.all(
    profiles.map(async (p) => {
      const hasKey = Boolean(await store.getApiKey(p.id));
      const name = mcpServerName(p);
      const durable = durableEntryExists(name);
      const dynamic = registrar.isDynamicallyRegistered(name);
      return (
        `• ${p.name} → ${p.baseUrl}\n` +
        `  MCP: ${name}\n` +
        `  key: ${hasKey ? "SecretStorage OK" : "MISSING"}\n` +
        `  durable mcp.json: ${durable ? "yes" : "no"}\n` +
        `  dynamic registerServer (this session): ${dynamic ? "yes" : "no"}\n` +
        `  optional OS env name: ${envVarNameForProfile(p)}`
      );
    })
  );

  const text = `Kitchen.co MCP (Unofficial) profiles (${profiles.length})\n${UNOFFICIAL_ONE_LINER}\nmcp.json: ${userMcpJsonPath()}\n\n${lines.join("\n\n")}`;
  logInfo(text.replace(/\n/g, " | "));
  getLog().show(true);
  vscode.window.showInformationMessage(text, { modal: true });
}

async function reregister(options: {
  showMessage: boolean;
  fromActivate?: boolean;
  previousNames?: Map<string, string>;
}): Promise<void> {
  logInfo(
    options.fromActivate
      ? "Auto-register on activate…"
      : "Re-register requested…"
  );

  const result = await registrar.registerAll({
    previousNames: options.previousNames,
  });

  const summary =
    `registered profiles=${result.ok}, durable=${result.durableOk}, ` +
    `dynamic=${result.dynamicOk}, skipped=${result.skipped}, ` +
    `apiReady=${result.apiReady}` +
    (result.errors.length ? `, errors: ${result.errors.join("; ")}` : "");

  logInfo(summary);

  if (!options.showMessage) return;

  if (result.errors.length) {
    vscode.window
      .showWarningMessage(
        `Kitchen.co MCP: ${summary}`,
        "Show Log"
      )
      .then((c) => {
        if (c === "Show Log") getLog().show(true);
      });
  } else if (result.ok === 0 && store.list().length === 0) {
    vscode.window.showInformationMessage("Kitchen.co MCP: no profiles to register.");
  } else {
    const prefix = options.fromActivate ? "Startup sync" : "Re-register";
    vscode.window
      .showInformationMessage(
        `Kitchen.co MCP: ${prefix} OK — ${result.durableOk} durable in mcp.json` +
          (result.dynamicOk ? `, ${result.dynamicOk} dynamic` : "") +
          ".",
        "Show Log"
      )
      .then((c) => {
        if (c === "Show Log") getLog().show(true);
      });
  }
}

async function testConnection(): Promise<void> {
  const profile = await pickProfile("Test connection");
  if (!profile) return;

  const apiKey = await store.getApiKey(profile.id);
  if (!apiKey) {
    vscode.window.showErrorMessage(
      `Kitchen.co MCP: profile "${profile.name}" has no API key stored.`
    );
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Kitchen.co MCP: testing ${profile.name}…`,
    },
    async () => {
      try {
        await probeKitchenApi(profile.baseUrl, apiKey);
        logInfo(`Connection OK for ${profile.name}`);
        vscode.window.showInformationMessage(
          `Kitchen.co MCP: connection OK for "${profile.name}" (${profile.baseUrl}).`
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logError(`Connection failed for ${profile.name}: ${message}`);
        vscode.window.showErrorMessage(
          `Kitchen.co MCP: connection failed for "${profile.name}": ${message}`
        );
      }
    }
  );
}

async function probeKitchenApi(baseUrl: string, apiKey: string): Promise<void> {
  const root = normalizeBaseUrlInput(baseUrl).replace(/\/+$/, "") + "/api";
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
    Authorization: `Bearer ${apiKey}`,
  };

  const tryPath = async (path: string) => {
    const res = await fetch(`${root}${path}`, { headers });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} on ${path}`);
    }
  };

  try {
    await tryPath("/templates?page=1&per_page=1");
  } catch {
    await tryPath("/tasks?page=1&per_page=1");
  }
}

async function pickProfile(
  placeHolder: string
): Promise<KitchenProfile | undefined> {
  const profiles = store.list();
  if (profiles.length === 0) {
    vscode.window.showInformationMessage(
      "Kitchen.co MCP: no profiles yet. Run “Add Profile” first."
    );
    return undefined;
  }

  const picked = await vscode.window.showQuickPick(
    profiles.map((p) => ({
      label: p.name,
      description: p.baseUrl,
      detail: `MCP: ${mcpServerName(p)} · durable: ${
        durableEntryExists(mcpServerName(p)) ? "yes" : "no"
      }`,
      profile: p,
    })),
    { placeHolder, ignoreFocusOut: true }
  );

  return picked?.profile;
}
