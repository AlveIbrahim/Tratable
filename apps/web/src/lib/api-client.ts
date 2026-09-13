import { useAuthStore } from "./auth-store";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public issues?: { path: string; message: string }[],
  ) {
    super(message);
  }
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  // Coalesce concurrent 401s into a single refresh call.
  if (!refreshPromise) {
    refreshPromise = fetch("/api/auth/refresh", { method: "POST", credentials: "include" })
      .then(async (res) => {
        if (!res.ok) return false;
        const data = await res.json();
        useAuthStore.getState().setSession(data.user, data.accessToken);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | object | undefined>;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(path, "http://placeholder");
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue;
      url.searchParams.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
    }
  }
  return url.pathname + url.search;
}

export async function apiFetch<T>(path: string, opts: RequestOptions = {}, isRetry = false): Promise<T> {
  const token = useAuthStore.getState().accessToken;
  const res = await fetch(buildUrl(`/api${path}`, opts.query), {
    method: opts.method ?? "GET",
    credentials: "include",
    headers: {
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 401 && !isRetry) {
    const refreshed = await tryRefresh();
    if (refreshed) return apiFetch<T>(path, opts, true);
    useAuthStore.getState().clearSession();
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message ?? "Request failed", body.issues);
  }

  // A 204 always has no body, but plenty of handlers (e.g. our DELETE
  // routes, which return void) come back as 200 with Content-Length: 0
  // instead — res.json() on a truly empty body throws a SyntaxError, which
  // silently rejects the caller's promise before it ever reaches .then()/
  // onSuccess. That's not a hypothetical: it's exactly why record deletes
  // looked like they "needed a page refresh" — the DELETE succeeded on the
  // server, but the frontend's promise chain broke on parsing before the
  // query-cache invalidation that would have removed the row ever ran.
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  get: <T>(path: string, query?: RequestOptions["query"]) => apiFetch<T>(path, { query }),
  post: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: "POST", body }),
  patch: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: "DELETE" }),
};
