"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import AuthHeader from "@/components/auth/AuthHeader";
import AuthLayout from "@/components/auth/AuthLayout";
import AuthInput from "@/components/auth/AuthInput";
import PrimaryButton from "@/components/auth/PrimaryButton";
import { resendVerificationEmail, verifyEmail } from "@/services/auth";

export default function VerifyEmailPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    setEmail(new URLSearchParams(window.location.search).get("email") ?? "");
  }, []);

  async function submitVerification() {
    if (!email.trim() || !/^\d{6}$/.test(code)) {
      toast.error("Enter your email and the six-digit verification code.");
      return;
    }
    setLoading(true);
    try {
      const result = await verifyEmail(email, code);
      toast.success("Email verified!", { description: result.message });
      window.setTimeout(() => router.push("/login"), 700);
    } catch (error) {
      toast.error("Verification failed", { description: error instanceof Error ? error.message : "Please try again." });
    } finally {
      setLoading(false);
    }
  }

  async function resendCode() {
    if (!email.trim()) {
      toast.error("Enter your email address first.");
      return;
    }
    setResending(true);
    try {
      const result = await resendVerificationEmail(email);
      if (result.success) toast.success("New code sent", { description: result.message });
      else toast.error(result.message);
    } catch (error) {
      toast.error("Could not resend code", { description: error instanceof Error ? error.message : "Please try again." });
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthLayout>
      <AuthHeader />
      <section className="rounded-2xl border border-black/15 bg-[#EAE6DB] p-6 shadow-lg shadow-black/5 dark:border-white/15 dark:bg-[#191919]">
        <h1 className="text-2xl font-bold text-[#181211] dark:text-white">Verify your email</h1>
        <p className="mt-1 text-sm text-[#526174] dark:text-slate-300">We sent a six-digit code to your email address.</p>
        <AuthInput label="Email" type="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
        <AuthInput label="Verification code" type="text" placeholder="123456" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} />
        <PrimaryButton text={loading ? "Verifying..." : "Verify email"} onClick={submitVerification} disabled={loading || !email.trim() || code.length !== 6} />
        <button type="button" onClick={resendCode} disabled={resending} className="mt-4 w-full text-sm font-semibold text-[#0878D1] hover:underline disabled:opacity-60">
          {resending ? "Sending a new code..." : "Resend verification code"}
        </button>
        <p className="mt-4 text-center text-sm text-[#526174] dark:text-slate-300">Already verified? <Link className="font-semibold text-[#181211] hover:underline dark:text-white" href="/login">Log in</Link></p>
      </section>
    </AuthLayout>
  );
}
