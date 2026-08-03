import { API_URL } from "@/lib/api";

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
