export async function loginUser(
    email: string,
    password: string
) {
    const response = await fetch(
        "http://127.0.0.1:8000/api/auth/login",
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

    if (!response.ok) {
        throw new Error("Invalid email or password");
    }

    return await response.json();
}


// ================= REGISTER =================

export async function registerUser(
    fullName: string,
    email: string,
    password: string
) {

    const response = await fetch(
        "http://127.0.0.1:8000/api/auth/register",
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