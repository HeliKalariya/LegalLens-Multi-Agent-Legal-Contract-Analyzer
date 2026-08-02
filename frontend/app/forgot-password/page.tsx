/* eslint-disable react/no-unescaped-entities */
import Link from "next/link";

import AuthLayout from "@/components/auth/AuthLayout";
import AuthHeader from "@/components/auth/AuthHeader";
import AuthInput from "@/components/auth/AuthInput";
import PrimaryButton from "@/components/auth/PrimaryButton";
import BackHome from "@/components/auth/BackHome";

export default function ForgotPasswordPage() {
  return (
    <AuthLayout>
      <AuthHeader />

      <div className="bg-[#F5F1E8] border border-gray-300 rounded-3xl shadow-md p-7">

        {/* Heading */}

        <h2 className="text-3xl font-bold text-black">
          Forgot Password?
        </h2>

        <p className="mt-2 text-sm text-gray-700">
          Enter your email address and we'll send you a password reset link.
        </p>

        {/* Email */}

        <AuthInput
          label="Email"
          type="email"
          placeholder="you@example.com"
          name="email"
        />

        {/* Button */}

        <PrimaryButton
          text="Send Reset Link"
          type="submit"
        />

        {/* Back to Login */}

        <p className="mt-6 text-center text-sm text-gray-700">
          Remember your password?{" "}
          <Link
            href="/login"
            className="font-semibold text-black hover:underline"
          >
            Back to Login
          </Link>
        </p>

      </div>

      <BackHome />
    </AuthLayout>
  );
}