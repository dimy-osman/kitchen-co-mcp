import * as fs from "fs";
import * as path from "path";
import { isIP } from "net";

/** Redact secrets from strings before logging or UI. */
export function redactSecrets(
  input: string,
  extraSecrets: string[] = []
): string {
  let out = input;
  for (const secret of extraSecrets) {
    if (secret && secret.length >= 4) {
      out = out.split(secret).join("[REDACTED]");
    }
  }
  out = out.replace(
    /(Bearer\s+)[A-Za-z0-9._\-]+/gi,
    "$1[REDACTED]"
  );
  out = out.replace(
    /(KITCHEN_API_KEY\s*[=:]\s*)\S+/gi,
    "$1[REDACTED]"
  );
  out = out.replace(
    /(api[_-]?key|token|authorization)(["']?\s*[:=]\s*["']?)[^"'\s,]+/gi,
    "$1$2[REDACTED]"
  );
  return out;
}

export function sanitizeProfileId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id
  );
}

/** Safe MCP server slug segment — no path separators. */
export function sanitizeSlug(name: string, fallback: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const safe = slug || fallback.replace(/[^a-z0-9-]/gi, "").slice(0, 8) || "profile";
  if (safe.includes("..") || safe.includes("/") || safe.includes("\\")) {
    return "profile";
  }
  return safe;
}

export function assertInsideDirectory(
  candidate: string,
  rootDir: string,
  label: string
): string {
  const resolved = path.resolve(candidate);
  const root = path.resolve(rootDir);
  const rel = path.relative(root, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`Security: ${label} escapes allowed directory`);
  }
  return resolved;
}

function isPrivateOrLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host === "metadata.google.internal" ||
    host.endsWith(".localhost") ||
    host === "0.0.0.0"
  ) {
    return true;
  }

  const ipVersion = isIP(host);
  if (!ipVersion) {
    // Block obvious link-local / internal name patterns
    if (
      host.endsWith(".local") ||
      host.endsWith(".internal") ||
      host.startsWith("127.")
    ) {
      return true;
    }
    return false;
  }

  if (ipVersion === 4) {
    const parts = host.split(".").map(Number);
    const [a, b] = parts;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local / cloud metadata
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }

  // IPv6 local/link-local/unique-local
  const h = host.toLowerCase();
  return (
    h === "::1" ||
    h.startsWith("fc") ||
    h.startsWith("fd") ||
    h.startsWith("fe80")
  );
}

export type ValidateBaseUrlResult =
  | { ok: true; url: string; hostname: string }
  | { ok: false; error: string };

/**
 * HTTPS-only public hosts. Blocks localhost/private/metadata IPs (SSRF).
 * Allows custom domains (e.g. web.dimyosman.com) and *.kitchen.co.
 */
export function validateAndNormalizeBaseUrl(
  input: string,
  options?: { allowHttpLocalhost?: boolean }
): ValidateBaseUrlResult {
  let value = input.trim().replace(/\/+$/, "");
  if (!value) {
    return { ok: false, error: "Base URL is required" };
  }

  if (!/^https?:\/\//i.test(value) && !value.includes(".")) {
    value = `https://${value}.kitchen.co`;
  } else if (!/^https?:\/\//i.test(value)) {
    value = `https://${value}`;
  }

  value = value.replace(/\/api$/i, "");

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, error: "Invalid URL" };
  }

  if (parsed.username || parsed.password) {
    return { ok: false, error: "URL must not contain embedded credentials" };
  }

  if (parsed.protocol !== "https:") {
    if (
      !(
        options?.allowHttpLocalhost &&
        parsed.protocol === "http:" &&
        isPrivateOrLocalHost(parsed.hostname)
      )
    ) {
      return { ok: false, error: "Only https:// URLs are allowed" };
    }
  } else if (isPrivateOrLocalHost(parsed.hostname)) {
    return {
      ok: false,
      error: "Local/private/metadata hosts are not allowed (SSRF protection)",
    };
  }

  if (parsed.port && parsed.port !== "443" && parsed.port !== "80") {
    // Allow non-default ports on public https hosts (some self-hosted setups)
    // but still blocked private hosts above.
  }

  return {
    ok: true,
    url: `${parsed.protocol}//${parsed.host}`.replace(/\/+$/, ""),
    hostname: parsed.hostname,
  };
}

/** Overwrite then delete a file that may contain secrets. */
export function secureUnlink(filePath: string): void {
  try {
    if (!fs.existsSync(filePath)) return;
    const stat = fs.statSync(filePath);
    if (stat.isFile() && stat.size > 0 && stat.size < 1_000_000) {
      const buf = Buffer.alloc(stat.size, 0);
      fs.writeFileSync(filePath, buf);
    }
    fs.unlinkSync(filePath);
  } catch {
    try {
      fs.unlinkSync(filePath);
    } catch {
      // ignore
    }
  }
}
