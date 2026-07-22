"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/api";

/** Signs in a user and saves the JWT used to protect their document history. */
export default function LoginPage() {
  const router = useRouter();
  const [isRegistering, setIsRegistering] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/api/auth/${isRegistering ? "register" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isRegistering ? { full_name: fullName, email, password } : { email, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail ?? "Could not continue.");

      const loginResult = isRegistering
        ? await (await fetch(`${API_URL}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          })).json()
        : result;
      if (!loginResult.access_token) throw new Error(loginResult.detail ?? "Account created, but sign-in failed.");
      localStorage.setItem("access_token", loginResult.access_token);
      router.push("/upload");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Could not sign in.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F5F1E9] p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-3xl bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold">{isRegistering ? "Create account" : "Sign in"}</h1>
        <p className="mt-2 text-gray-600">{isRegistering ? "Create an account to keep your document history private." : "Sign in to access your private document history."}</p>
        {isRegistering && <><label className="mt-6 block text-sm font-medium">Full name</label><input required value={fullName} onChange={(event) => setFullName(event.target.value)} className="mt-2 w-full rounded-xl border p-3" /></>}
        <label className="mt-6 block text-sm font-medium">Email</label>
        <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border p-3" />
        <label className="mt-4 block text-sm font-medium">Password</label>
        <input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border p-3" />
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={isSubmitting} className="mt-6 w-full rounded-xl bg-black p-3 font-semibold text-white disabled:bg-gray-400">
          {isSubmitting ? "Please wait…" : isRegistering ? "Create account" : "Sign in"}
        </button>
        <button type="button" className="mt-4 w-full text-sm font-medium text-blue-600" onClick={() => { setIsRegistering((value) => !value); setError(""); }}>
          {isRegistering ? "Already have an account? Sign in" : "Need an account? Create one"}
        </button>
      </form>
    </main>
  );
}
