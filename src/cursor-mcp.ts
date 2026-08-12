/**
 * Cursor MCP Extension API helpers.
 * @see https://cursor.com/docs/extension-api
 */
import * as vscode from "vscode";

export type ExtMCPServerConfig =
  | {
      name: string;
      server: {
        command: string;
        args: string[];
        env: Record<string, string>;
      };
    }
  | {
      name: string;
      server: {
        url: string;
        headers?: Record<string, string>;
      };
    };

export type CursorMcpApi = {
  registerServer: (config: ExtMCPServerConfig) => void;
  unregisterServer: (serverName: string) => void;
};

export function getCursorMcpApi(): CursorMcpApi | undefined {
  const anyVscode = vscode as unknown as {
    cursor?: { mcp?: Partial<CursorMcpApi> };
  };
  const mcp = anyVscode.cursor?.mcp;
  if (
    mcp &&
    typeof mcp.registerServer === "function" &&
    typeof mcp.unregisterServer === "function"
  ) {
    return mcp as CursorMcpApi;
  }
  return undefined;
}
