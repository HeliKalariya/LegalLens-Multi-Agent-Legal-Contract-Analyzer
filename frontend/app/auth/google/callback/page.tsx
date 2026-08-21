"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleX, LoaderCircle } from "lucide-react";
import { toast } from "sonner";

/** Receives tokens from the backend in the URL fragment after Google OAuth. */
export default function GoogleCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    const values = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = values.get("access_token");
    const refreshToken = values.get("refresh_token");
    const signInError = values.get("error");

    if (signInError || !accessToken || !refreshToken) {
      const message = signInError || "Google sign-in did not return a valid session.";
      setError(message);
      toast.error("Google sign-in failed", { description: message });
      const timer = window.setTimeout(() => router.replace("/login"), 2500);
      return () => window.clearTimeout(timer);
    }

    localStorage.setItem("access_token", accessToken);
    localStorage.setItem("refresh_token", refreshToken);
    // Remove the fragment so authentication tokens do not remain in browser history.
    window.history.replaceState(null, "", "/auth/google/callback");
    toast.success("Google sign-in successful!", { description: "Welcome to LegalLens." });
    const timer = window.setTimeout(() => router.replace("/dashboard"), 500);
    return () => window.clearTimeout(timer);
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F3EA] p-4 dark:bg-[#101010]">
      <section className="w-full max-w-sm rounded-2xl border border-black/10 bg-[#EAE6DB] p-7 text-center shadow-lg dark:border-white/15 dark:bg-[#191919]">
        {error ? <CircleX className="mx-auto h-10 w-10 text-red-500" /> : <LoaderCircle className="mx-auto h-10 w-10 animate-spin text-[#0878D1]" />}
        <h1 className="mt-4 text-xl font-bold text-[#181211] dark:text-white">
          {error ? "Google sign-in failed" : "Signing you in with Google"}
        </h1>
        <p className="mt-2 text-sm text-[#526174] dark:text-slate-300">
          {error || "Your secure LegalLens session is being created."}
        </p>
      </section>
    </main>
  );
}
