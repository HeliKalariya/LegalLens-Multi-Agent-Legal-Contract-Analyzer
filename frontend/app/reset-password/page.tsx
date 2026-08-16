"use client";

import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import AuthHeader from "@/components/auth/AuthHeader";
import AuthLayout from "@/components/auth/AuthLayout";
import ErrorMessage from "@/components/auth/ErrorMessage";
import PasswordInput from "@/components/auth/PasswordInput";
import PrimaryButton from "@/components/auth/PrimaryButton";
import { resetPassword } from "@/services/auth";
import { validateSignup } from "@/validations/signupValidation";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordLoading />}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [complete, setComplete] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const passwordError = validateSignup("LegalLens User", "user@example.com", password).password;
    const nextError = !token ? "This reset link is invalid or incomplete." : passwordError || (password !== confirmPassword ? "Passwords do not match." : "");
    setError(nextError);
    if (nextError) return;

    setIsSaving(true);
    try {
      const result = await resetPassword(token, password);
      if (!result.success) throw new Error(result.message);
      setComplete(true);
      toast.success("Password updated", { description: "You can now log in with your new password." });
      window.setTimeout(() => router.push("/login"), 1200);
    } catch (resetError) {
      toast.error("Could not reset password", { description: resetError instanceof Error ? resetError.message : "Please request a new link." });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AuthLayout>
      <AuthHeader />
      <section className="rounded-2xl border border-black/15 bg-[#EAE6DB] p-6 shadow-lg shadow-black/5">
        {complete ? (
          <div className="py-4 text-center"><CircleCheck className="mx-auto h-12 w-12 text-green-600" /><h1 className="mt-4 text-2xl font-bold text-[#181211]">Password updated</h1><p className="mt-2 text-sm text-[#526174]">Redirecting you to login…</p></div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <h1 className="text-2xl font-bold tracking-tight text-[#181211]">Create a new password</h1>
            <p className="mt-1 text-sm leading-6 text-[#526174]">Choose a strong password that you do not use elsewhere.</p>
            <PasswordInput label="New password" name="password" placeholder="Create a strong password" value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} />
            <PasswordInput label="Confirm new password" name="confirm-password" placeholder="Repeat your new password" value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setError(""); }} />
            <ErrorMessage message={error} />
            <div className="mt-5"><PrimaryButton text={isSaving ? "Updating password..." : "Update password"} type="submit" disabled={isSaving || !token} /></div>
          </form>
        )}
        <p className="mt-5 text-center text-sm text-[#526174]">Return to <Link href="/login" className="font-semibold text-[#181211] hover:underline">login</Link></p>
      </section>
    </AuthLayout>
  );
}

function ResetPasswordLoading() {
  return (
    <AuthLayout>
      <AuthHeader />
      <section className="rounded-2xl border border-black/15 bg-[#EAE6DB] p-6 shadow-lg shadow-black/5">
        <h1 className="text-2xl font-bold tracking-tight text-[#181211]">Checking reset link…</h1>
        <p className="mt-2 text-sm text-[#526174]">Please wait a moment.</p>
      </section>
    </AuthLayout>
  );
}
