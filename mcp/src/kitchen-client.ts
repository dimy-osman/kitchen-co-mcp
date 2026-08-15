/**
 * Thin Kitchen.co REST client.
 * Auth: Bearer API key. Docs: https://developer.kitchen.co/
 * SSRF hardened: only same-origin relative paths under configured https base.
 */

export type KitchenClientOptions = {
  baseUrl: string;
  apiKey: string;
};

export type QueryPrimitive = string | number | boolean;
export type QueryValue = QueryPrimitive | QueryPrimitive[] | undefined | null;
export type QueryRecord = Record<string, QueryValue>;

const QUERY_KEY_RE = /^[A-Za-z0-9_.-]+$/;

function isEmptyQueryValue(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

function isInternalApiPath(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, "") || "/";
  return p === "/api/internal" || p.startsWith("/api/internal/");
}

/**
 * Laravel-style query encoding. Arrays become key[]=a&key[]=b.
 * Kitchen rejects expand as a scalar ("The expand field must be an array").
 */
export function applyQueryParams(url: URL, query: QueryRecord): void {
  for (const [rawKey, value] of Object.entries(query)) {
    if (isEmptyQueryValue(value)) continue;

    const alreadyBracketed = rawKey.endsWith("[]");
    const baseKey = alreadyBracketed ? rawKey.slice(0, -2) : rawKey;
    if (!QUERY_KEY_RE.test(baseKey)) {
      throw new Error(`Invalid query parameter name: ${rawKey}`);
    }

    const items = Array.isArray(value)
      ? value
      : baseKey === "expand"
        ? [value]
        : null;

    if (items) {
      for (const item of items) {
        if (isEmptyQueryValue(item)) continue;
        url.searchParams.append(`${baseKey}[]`, String(item));
      }
      continue;
    }

    if (alreadyBracketed) {
      url.searchParams.append(`${baseKey}[]`, String(value));
      continue;
    }

    url.searchParams.set(baseKey, String(value));
  }
}

export class KitchenApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string
  ) {
    super(message);
    this.name = "KitchenApiError";
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  let url = baseUrl.trim().replace(/\/+$/, "");
  if (!/^https:\/\//i.test(url)) {
    throw new Error("KITCHEN_BASE_URL must be https://");
  }
  if (!/\/api$/i.test(url)) {
    url = `${url}/api`;
  }
  return url;
}

function isBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h === "metadata.google.internal" ||
    h.endsWith(".local") ||
    h.endsWith(".internal")
  ) {
    return true;
  }
  if (/^(127|10|0)\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true;
  if (h === "::1" || h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) {
    return true;
  }
  return false;
}

export class KitchenClient {
  readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly originHost: string;

  constructor(opts: KitchenClientOptions) {
    if (!opts.apiKey?.trim()) {
      throw new Error("KITCHEN_API_KEY is required");
    }
    if (!opts.baseUrl?.trim()) {
      throw new Error("KITCHEN_BASE_URL is required");
    }
    this.baseUrl = normalizeBaseUrl(opts.baseUrl);
    this.apiKey = opts.apiKey.trim();
    const parsed = new URL(this.baseUrl);
    if (isBlockedHostname(parsed.hostname)) {
      throw new Error("Refusing to use local/private API host");
    }
    this.originHost = parsed.hostname.toLowerCase();
  }

  private resolveUrl(path: string): URL {
    // Absolute URLs only allowed to the same host (prevent SSRF via kitchen_request)
    if (/^https?:\/\//i.test(path)) {
      const abs = new URL(path);
      if (abs.protocol !== "https:") {
        throw new Error("Refusing non-HTTPS absolute URL");
      }
      if (abs.hostname.toLowerCase() !== this.originHost) {
        throw new Error("Refusing absolute URL to a different host (SSRF protection)");
      }
      if (abs.username || abs.password) {
        throw new Error("Refusing URL with embedded credentials");
      }
      return abs;
    }

    if (path.includes("://") || path.startsWith("//")) {
      throw new Error("Invalid API path");
    }

    const normalized = path.startsWith("/") ? path : `/${path}`;
    // Block path tricks that escape to other schemes
    if (normalized.includes("\\") || /\s/.test(normalized)) {
      throw new Error("Invalid API path characters");
    }

    return new URL(`${this.baseUrl.replace(/\/+$/, "")}${normalized}`);
  }

  async request<T = unknown>(
    method: string,
    path: string,
    options?: {
      query?: QueryRecord;
      body?: unknown;
    }
  ): Promise<T> {
    const allowed = ["GET", "POST", "PUT", "PATCH", "DELETE"];
    const verb = method.toUpperCase();
    if (!allowed.includes(verb)) {
      throw new Error(`Unsupported HTTP method: ${method}`);
    }

    const url = this.resolveUrl(path);
    if (url.hostname.toLowerCase() !== this.originHost) {
      throw new Error("Host mismatch after resolve (SSRF protection)");
    }
    if (isBlockedHostname(url.hostname)) {
      throw new Error("Refusing local/private host");
    }
    if (isInternalApiPath(url.pathname)) {
      throw new Error(
        "Bearer tokens cannot call /api/internal (401 Unauthenticated). That surface is session+CSRF for the Kitchen web UI. Use public /api paths and named tools. Client billing profiles, company membership, invoice finalize/send, quotes, and proposals are not on the public API yet."
      );
    }

    if (options?.query) {
      applyQueryParams(url, options.query);
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      Authorization: `Bearer ${this.apiKey}`,
    };

    const res = await fetch(url, {
      method: verb,
      headers,
      body:
        options?.body !== undefined ? JSON.stringify(options.body) : undefined,
      redirect: "error",
    });

    const text = await res.text();
    if (!res.ok) {
      const safeBody = text
        .slice(0, 2000)
        .replace(this.apiKey, "[REDACTED]")
        .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, "Bearer [REDACTED]");
      throw new KitchenApiError(
        `Kitchen API ${verb} ${url.pathname} failed (${res.status})`,
        res.status,
        safeBody
      );
    }

    if (!text) {
      return null as T;
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      return text as T;
    }
  }

  get<T = unknown>(path: string, query?: QueryRecord) {
    return this.request<T>("GET", path, { query });
  }

  post<T = unknown>(path: string, body?: unknown) {
    return this.request<T>("POST", path, { body });
  }

  put<T = unknown>(path: string, body?: unknown) {
    return this.request<T>("PUT", path, { body });
  }

  patch<T = unknown>(path: string, body?: unknown) {
    return this.request<T>("PATCH", path, { body });
  }

  delete<T = unknown>(path: string) {
    return this.request<T>("DELETE", path);
  }
}

export function createClientFromEnv(): KitchenClient {
  return new KitchenClient({
    baseUrl: process.env.KITCHEN_BASE_URL ?? "",
    apiKey: process.env.KITCHEN_API_KEY ?? "",
  });
}
