// İnce fetch katmanı: JSON, çekirdek hata biçimi ({ error, code }) ve oturum düşmesi
import { api as m } from "../messages.api";
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public candidates?: { id: number; label: string }[],
    /** mükerrer kayıt: var olan kayıt (çöp kutusundaysa geri yüklenebilir) */
    public duplicate?: { type: string; id: number; label: string; field: string; in_trash: boolean },
  ) {
    super(message);
  }
}

type AuthListener = () => void;
const authListeners = new Set<AuthListener>();
/** 401 gelince giriş ekranına dön */
export const onAuthRequired = (fn: AuthListener) => {
  authListeners.add(fn);
  return () => void authListeners.delete(fn);
};

export async function request<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      signal,
      credentials: "same-origin",
      // a FormData body (file upload) sets its own multipart header
      headers: body === undefined || body instanceof FormData ? undefined : { "content-type": "application/json" },
      body: body === undefined || body instanceof FormData ? (body as FormData | undefined) : JSON.stringify(body),
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError(m.unreachable, 0, "network");
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    if (res.status === 401) authListeners.forEach((fn) => fn());
    throw new ApiError(data?.error ?? res.statusText, res.status, data?.code, data?.candidates, data?.duplicate);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>("GET", path, undefined, signal),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),
};

/** Sorgu dizesi: boş değerler atılır */
export function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}
