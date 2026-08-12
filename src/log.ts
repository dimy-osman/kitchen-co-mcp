import * as vscode from "vscode";

let channel: vscode.OutputChannel | undefined;

export function getLog(): vscode.OutputChannel {
  if (!channel) {
    channel = vscode.window.createOutputChannel("Kitchen.co MCP");
  }
  return channel;
}

function safeLine(message: string): string {
  // Lazy import avoidance — inline minimal redact for circular deps
  return message
    .replace(/(Bearer\s+)[A-Za-z0-9._\-]+/gi, "$1[REDACTED]")
    .replace(/(KITCHEN_API_KEY\s*[=:]\s*)\S+/gi, "$1[REDACTED]");
}

export function logInfo(message: string): void {
  getLog().appendLine(`[info] ${safeLine(message)}`);
}

export function logWarn(message: string): void {
  getLog().appendLine(`[warn] ${safeLine(message)}`);
}

export function logError(message: string): void {
  getLog().appendLine(`[error] ${safeLine(message)}`);
}
