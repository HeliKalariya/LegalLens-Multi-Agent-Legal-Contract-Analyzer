import { toast } from "sonner";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

let isRedirectingToLogin = false;

/** Adds the signed-in user's token to protected API requests. */
export function authHeaders(): Record<string, string> {
  const token = typeof window === "undefined" ? null : localStorage.getItem("access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Sends an authenticated request and returns the user to login if their session expires. */
export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const token = typeof window === "undefined" ? null : localStorage.getItem("access_token");
  const response = await fetch(input, {
    ...init,
    headers: { ...init.headers, ...authHeaders() },
  });

  if (response.status === 401 && typeof window !== "undefined" && !isRedirectingToLogin) {
    isRedirectingToLogin = true;
    localStorage.removeItem("access_token");
    toast.error(token ? "Your session has expired. Please log in again." : "Please log in to continue.");
    window.setTimeout(() => window.location.assign("/login"), 1200);
  }

  return response;
}
