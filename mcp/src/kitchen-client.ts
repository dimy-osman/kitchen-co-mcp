/**
 * Thin Kitchen.co REST client.
 * Auth: Bearer API key. Base: https://{workspace}.kitchen.co
 * Docs: https://developer.kitchen.co/
 */

export type KitchenClientOptions = {
  baseUrl: string;
  apiKey: string;
};

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
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  // Accept workspace slug, host, or full API root
  if (!/\/api$/i.test(url)) {
    // https://acme.kitchen.co → https://acme.kitchen.co/api
    url = `${url}/api`;
  }
  return url;
}

export class KitchenClient {
  readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(opts: KitchenClientOptions) {
    if (!opts.apiKey?.trim()) {
      throw new Error("KITCHEN_API_KEY is required");
    }
    if (!opts.baseUrl?.trim()) {
      throw new Error("KITCHEN_BASE_URL is required");
    }
    this.baseUrl = normalizeBaseUrl(opts.baseUrl);
    this.apiKey = opts.apiKey.trim();
  }

  async request<T = unknown>(
    method: string,
    path: string,
    options?: {
      query?: Record<string, string | number | boolean | undefined | null>;
      body?: unknown;
    }
  ): Promise<T> {
    const url = new URL(
      path.startsWith("http")
        ? path
        : `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`
    );

    if (options?.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value === undefined || value === null || value === "") continue;
        url.searchParams.set(key, String(value));
      }
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      Authorization: `Bearer ${this.apiKey}`,
    };

    const res = await fetch(url, {
      method,
      headers,
      body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    const text = await res.text();
    if (!res.ok) {
      // Never include the API key in error messages
      throw new KitchenApiError(
        `Kitchen API ${method} ${url.pathname} failed (${res.status})`,
        res.status,
        text.slice(0, 2000)
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

  get<T = unknown>(
    path: string,
    query?: Record<string, string | number | boolean | undefined | null>
  ) {
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
