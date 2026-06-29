const BASE = import.meta.env.VITE_API_URL ?? "";
const TOKEN_KEY = "case-processor-token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

interface RequestOpts {
  method?: string;
  body?: unknown;
  /** When true, send FormData (for file upload) instead of JSON. */
  formData?: FormData;
}

async function request<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let body: BodyInit | undefined;
  if (opts.formData) {
    body = opts.formData;
  } else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }

  const res = await fetch(`${BASE}/api${path}`, { method: opts.method ?? "GET", headers, body });

  if (res.status === 401) {
    // Token missing/expired — drop it so the app redirects to login.
    setToken(null);
  }

  if (!res.ok) {
    let payload: { error?: { code?: string; message?: string; details?: unknown } } = {};
    try {
      payload = await res.json();
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(
      res.status,
      payload.error?.code ?? "ERROR",
      payload.error?.message ?? `Request failed (${res.status})`,
      payload.error?.details,
    );
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const apiGet = <T>(path: string) => request<T>(path);
export const apiPost = <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body });
export const apiPut = <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body });
export const apiUpload = <T>(path: string, formData: FormData) =>
  request<T>(path, { method: "POST", formData });
