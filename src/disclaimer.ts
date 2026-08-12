/**
 * User-facing unofficial / legal copy for the extension UI.
 * Keep in sync with README disclaimer section.
 */

export const EXTENSION_SHORT_NAME = "Kitchen.co MCP (Unofficial)";

export const UNOFFICIAL_ONE_LINER =
  "Unofficial community extension by Dimy Osman — not affiliated with, endorsed by, or supported by Kitchen.co.";

export const DISCLAIMER_TITLE = "Kitchen.co MCP — unofficial notice";

export const DISCLAIMER_BODY = [
  "This is NOT an official Kitchen.co extension.",
  "",
  "It is an independent, third-party project (KTCH-MCP) by Dimy Osman.",
  "It is not affiliated with, endorsed, sponsored, or approved by Kitchen.co, 2create.io, or their affiliates.",
  "",
  "Using this software does NOT grant you any legal rights, licenses, trademarks, partnership, or support from Kitchen.co.",
  "“Kitchen” / “Kitchen.co” names are used only to identify the third-party API this tool connects to.",
  "",
  "You must use your own Kitchen workspace URL and API token.",
  "You are responsible for token security and for any actions AI agents perform with your credentials.",
  "",
  "Software is provided AS IS under the MIT License, without warranty.",
  "For this project only: https://github.com/dimy-osman/kitchen-co-mcp",
  "Do not contact Kitchen.co support about this extension.",
].join("\n");

export const ACK_STORAGE_KEY = "kitchenMcp.disclaimerAcknowledged.v1";

/** One-time “add your first profile” prompt after install — never again. */
export const SETUP_PROMPT_KEY = "kitchenMcp.setupPromptShown.v1";
