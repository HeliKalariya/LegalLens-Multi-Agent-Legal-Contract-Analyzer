import { API_URL } from "@/lib/api";

const PASSWORD_RESET_REQUEST_TIMEOUT_MS = 18_000;

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = PASSWORD_RESET_REQUEST_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
            throw new Error("The server is taking too long to respond. Please try again after restarting the backend.");
        }
        throw error;
    } finally {
        window.clearTimeout(timeoutId);
    }
}

export async function loginUser(
    email: string,
    password: string
) {
    const response = await fetch(
        `${API_URL}/api/auth/login`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                email,
                password,
            }),
        }
    );

    const data = await response.json();
    if (!response.ok) throw new Error(data.detail ?? "Invalid email or password");
    return data;
}


// ================= REGISTER =================

export async function registerUser(
    fullName: string,
    email: string,
    password: string
) {

    const response = await fetch(
        `${API_URL}/api/auth/register`,
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
            },

            body: JSON.stringify({
                full_name: fullName,
                email: email,
                password: password,
            }),
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.detail);
    }

    return data;
}

/** Starts the browser-based Google OAuth flow handled by the FastAPI backend. */
export function signInWithGoogle() {
    window.location.assign(`${API_URL}/api/auth/google/login`);
}

/** Confirm the six-digit code sent after registration. */
export async function verifyEmail(email: string, code: string) {
    const response = await fetch(`${API_URL}/api/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
    });
    return readApiResponse(response);
}

/** Send a fresh registration verification code. */
export async function resendVerificationEmail(email: string) {
    const response = await fetchWithTimeout(`${API_URL}/api/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
    });
    return readApiResponse(response);
}

async function readApiResponse(response: Response) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.detail ?? data.message ?? "Something went wrong. Please try again.");
    }
    return data;
}

/** Request a single-use password reset link without exposing account existence. */
export async function requestPasswordReset(email: string) {
    const response = await fetchWithTimeout(`${API_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
    });
    return readApiResponse(response);
}

/** Redeem the reset-link token and choose a new account password. */
export async function resetPassword(token: string, newPassword: string) {
    const response = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: newPassword }),
    });
    return readApiResponse(response);
}
