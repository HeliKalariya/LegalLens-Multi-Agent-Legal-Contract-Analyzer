import { toast } from "sonner";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

let isRedirectingToLogin = false;
let refreshRequest: Promise<string | null> | null = null;

/** Adds the signed-in user's token to protected API requests. */
export function authHeaders(): Record<string, string> {
  const token = typeof window === "undefined" ? null : localStorage.getItem("access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function endSession(message: string) {
  if (typeof window === "undefined" || isRedirectingToLogin) return;

  isRedirectingToLogin = true;
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  toast.error(message);
  window.setTimeout(() => window.location.assign("/login"), 1200);
}

async function refreshAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (refreshRequest) return refreshRequest;

  const refreshToken = localStorage.getItem("refresh_token");
  if (!refreshToken) return null;

  refreshRequest = fetch(`${API_URL}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
    .then(async (response) => {
      if (!response.ok) return null;
      const data = await response.json();
      if (!data.access_token || !data.refresh_token) return null;

      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      return data.access_token as string;
    })
    .catch(() => null)
    .finally(() => {
      refreshRequest = null;
    });

  return refreshRequest;
}

/** Sends an authenticated request and returns the user to login if their session expires. */
export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  let token = typeof window === "undefined" ? null : localStorage.getItem("access_token");

  // A page reload can happen between access-token rotations. Restore it silently.
  if (!token) token = await refreshAccessToken();
  if (!token) {
    endSession("Please log in to continue.");
    return new Response(null, { status: 401 });
  }

  const request = (accessToken: string) => fetch(input, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${accessToken}` },
  });
  let response = await request(token);

  // Access tokens expire quickly; refresh once and retry the original protected request.
  if (response.status === 401) {
    const renewedToken = await refreshAccessToken();
    if (renewedToken) response = await request(renewedToken);
  }

  if (response.status === 401) {
    endSession("Your session has expired. Please log in again.");
  }

  return response;
}
