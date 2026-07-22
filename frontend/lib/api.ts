export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

/** Adds the current user's JWT to protected API requests. */
export function authHeaders(): Record<string, string> {
  const token = typeof window === "undefined" ? null : localStorage.getItem("access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}
