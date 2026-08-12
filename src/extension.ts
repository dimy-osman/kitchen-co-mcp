import * as vscode from "vscode";
import { McpRegistrar } from "./mcp-registrar";
import {
  ProfileStore,
  mcpServerName,
  normalizeBaseUrlInput,
  promptForProfile,
} from "./profiles";

let store: ProfileStore;
let registrar: McpRegistrar;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  store = new ProfileStore(context);
  registrar = new McpRegistrar(context, store);

  context.subscriptions.push(
    vscode.commands.registerCommand("kitchenMcp.addProfile", () => addProfile()),
    vscode.commands.registerCommand("kitchenMcp.editProfile", () => editProfile()),
    vscode.commands.registerCommand("kitchenMcp.removeProfile", () => removeProfile()),
    vscode.commands.registerCommand("kitchenMcp.listProfiles", () => listProfiles()),
    vscode.commands.registerCommand("kitchenMcp.reregister", () => reregister(true)),
    vscode.commands.registerCommand("kitchenMcp.testConnection", () => testConnection())
  );

  const auto = vscode.workspace
    .getConfiguration("kitchenMcp")
    .get<boolean>("autoRegister", true);

  if (auto && store.list().length > 0) {
    await reregister(false);
  } else if (store.list().length === 0) {
    vscode.window
      .showInformationMessage(
        "Kitchen.co MCP: add a workspace profile to connect Cursor agents.",
        "Add Profile"
      )
      .then((choice) => {
        if (choice === "Add Profile") {
          void vscode.commands.executeCommand("kitchenMcp.addProfile");
        }
      });
  }
}

export function deactivate(): void {
  void registrar?.unregisterAll();
}

async function addProfile(): Promise<void> {
  const result = await promptForProfile(undefined, { requireApiKey: true });
  if (!result) return;

  const profile = await store.upsert(result.profile, result.apiKey);
  await reregister(true);
  vscode.window.showInformationMessage(
    `Kitchen.co MCP: added profile "${profile.name}" as MCP server "${mcpServerName(profile)}". API key stored in OS keychain.`
  );
}

async function editProfile(): Promise<void> {
  const profile = await pickProfile("Edit profile");
  if (!profile) return;

  const result = await promptForProfile(profile);
  if (!result) return;

  const updated = await store.upsert(result.profile, result.apiKey);
  await reregister(true);
  vscode.window.showInformationMessage(
    `Kitchen.co MCP: updated profile "${updated.name}".`
  );
}

async function removeProfile(): Promise<void> {
  const profile = await pickProfile("Remove profile");
  if (!profile) return;

  const confirm = await vscode.window.showWarningMessage(
    `Remove Kitchen profile "${profile.name}"? The API key will be deleted from SecretStorage.`,
    { modal: true },
    "Remove"
  );
  if (confirm !== "Remove") return;

  await store.remove(profile.id);
  await reregister(true);
  vscode.window.showInformationMessage(
    `Kitchen.co MCP: removed profile "${profile.name}".`
  );
}

async function listProfiles(): Promise<void> {
  const profiles = store.list();
  if (profiles.length === 0) {
    vscode.window.showInformationMessage("Kitchen.co MCP: no profiles configured.");
    return;
  }

  const lines = await Promise.all(
    profiles.map(async (p) => {
      const hasKey = Boolean(await store.getApiKey(p.id));
      return `• ${p.name} → ${p.baseUrl} (MCP: ${mcpServerName(p)}, key: ${
        hasKey ? "stored securely" : "MISSING"
      })`;
    })
  );

  vscode.window.showInformationMessage(
    `Kitchen.co MCP profiles (${profiles.length}):\n${lines.join("\n")}`,
    { modal: true }
  );
}

async function reregister(showMessage: boolean): Promise<void> {
  const result = await registrar.registerAll();
  if (!showMessage) return;

  if (result.errors.length) {
    vscode.window.showWarningMessage(
      `Kitchen.co MCP: registered ${result.ok}, skipped ${result.skipped}. ${result.errors.join(
        " "
      )}`
    );
  } else {
    vscode.window.showInformationMessage(
      `Kitchen.co MCP: registered ${result.ok} server(s) with Cursor.`
    );
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
        vscode.window.showInformationMessage(
          `Kitchen.co MCP: connection OK for "${profile.name}" (${profile.baseUrl}).`
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
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
): Promise<import("./profiles").KitchenProfile | undefined> {
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
      detail: `MCP server: ${mcpServerName(p)}`,
      profile: p,
    })),
    { placeHolder, ignoreFocusOut: true }
  );

  return picked?.profile;
}
