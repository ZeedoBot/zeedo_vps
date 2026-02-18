/**
 * Cliente da API do backend (FastAPI).
 * Envia o token de sessão do Supabase no header Authorization.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function apiFetch(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<Response> {
  const { token, ...rest } = options;
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(rest.headers as Record<string, string>),
  };
  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }
  return fetch(`${API_URL}${path}`, { ...rest, headers });
}

export async function apiGet<T = unknown>(path: string, token: string): Promise<T> {
  const res = await apiFetch(path, { method: "GET", token });
  if (!res.ok) throw new Error(await parseErrorResponse(res));
  return res.json();
}

async function parseErrorResponse(res: Response): Promise<string> {
  const text = await res.text().catch(() => res.statusText);
  try {
    const json = JSON.parse(text);
    const d = json.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d) && d.length > 0 && d[0]?.msg) return d[0].msg;
    return text;
  } catch {
    return text;
  }
}

export async function apiPost<T = unknown>(
  path: string,
  body: unknown,
  token?: string
): Promise<T> {
  const res = await apiFetch(path, { method: "POST", body: JSON.stringify(body), token: token ?? undefined });
  if (!res.ok) throw new Error(await parseErrorResponse(res));
  return res.json();
}

export async function apiPut<T = unknown>(
  path: string,
  body: unknown,
  token: string
): Promise<T> {
  const res = await apiFetch(path, { method: "PUT", body: JSON.stringify(body), token });
  if (!res.ok) throw new Error(await parseErrorResponse(res));
  return res.json();
}
