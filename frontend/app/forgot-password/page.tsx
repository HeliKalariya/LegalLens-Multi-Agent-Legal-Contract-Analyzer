"use client";

import Link from "next/link";
import { MailCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import AuthHeader from "@/components/auth/AuthHeader";
import AuthInput from "@/components/auth/AuthInput";
import AuthLayout from "@/components/auth/AuthLayout";
import ErrorMessage from "@/components/auth/ErrorMessage";
import PrimaryButton from "@/components/auth/PrimaryButton";
import { requestPasswordReset } from "@/services/auth";
import { validateForgotPassword } from "@/validations/forgotPasswordValidation";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextError = validateForgotPassword(email).email ?? "";
    setError(nextError);
    if (nextError) return;

    setIsSending(true);
    try {
      await requestPasswordReset(email.trim().toLowerCase());
      setSent(true);
      toast.success("Reset link sent", { description: "Check your inbox for a secure password reset link." });
    } catch (requestError) {
      toast.error("Could not send reset link", {
        description: requestError instanceof Error ? requestError.message : "Please try again.",
      });
    } finally {
      setIsSending(false);
    }
  }

  return (
    <AuthLayout>
      <AuthHeader />
      <section className="rounded-2xl border border-black/15 bg-[#EAE6DB] p-6 shadow-lg shadow-black/5">
        {sent ? (
          <div className="py-3 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#DDF7E8] text-[#0875D1]"><MailCheck className="h-6 w-6" /></div>
            <h1 className="mt-4 text-2xl font-bold text-[#181211]">Check your inbox</h1>
            <p className="mt-2 text-sm leading-6 text-[#526174]">If an account exists for <strong className="text-[#181211]">{email}</strong>, we sent a single-use password reset link. It expires in 15 minutes.</p>
            <button type="button" onClick={() => setSent(false)} className="mt-5 text-sm font-semibold text-[#0875D1] hover:underline">Use a different email</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <h1 className="text-2xl font-bold tracking-tight text-[#181211]">Forgot password?</h1>
            <p className="mt-1 text-sm leading-6 text-[#526174]">Enter your account email and we&apos;ll send a secure reset link.</p>
            <AuthInput label="Email" type="email" name="email" placeholder="you@example.com" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} />
            <ErrorMessage message={error} />
            <div className="mt-5"><PrimaryButton text={isSending ? "Sending link..." : "Send reset link"} type="submit" disabled={isSending} /></div>
          </form>
        )}
        <p className="mt-5 text-center text-sm text-[#526174]">Remember your password? <Link href="/login" className="font-semibold text-[#181211] hover:underline">Back to login</Link></p>
      </section>
    </AuthLayout>
  );
}
