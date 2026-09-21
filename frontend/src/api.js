const getApiBase = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof window !== "undefined") {
    // In local dev mode (Vite dev server port 5173 / 3000), point to local backend port 8000
    if (window.location.port === "5173" || window.location.port === "3000") {
      return `${window.location.protocol}//${window.location.hostname}:8000`;
    }
    // In production / cloud, frontend and backend share the same origin
    return "";
  }
  return "http://127.0.0.1:8000";
};

const API_BASE = getApiBase();

export async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(30000),
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = err.detail;
    throw new Error(
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((e) => `${e.loc?.join(".")}: ${e.msg}`).join("; ")
          : `API Error ${res.status}`,
    );
  }

  if (res.status === 204) return null;
  return res.json();
}

export async function fetchOpenAPISpec() {
  const res = await fetch(`${API_BASE}/openapi.json`);
  if (!res.ok) throw new Error("Failed to fetch OpenAPI spec");
  return res.json();
}
