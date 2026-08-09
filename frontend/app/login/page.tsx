"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginUser } from "@/services/auth";
import Link from "next/link";
import { toast } from "sonner";

import { validateLogin } from "@/validations/loginValidation";
import ErrorMessage from "@/components/auth/ErrorMessage";

import AuthLayout from "@/components/auth/AuthLayout";
import AuthHeader from "@/components/auth/AuthHeader";
import AuthInput from "@/components/auth/AuthInput";
import PasswordInput from "@/components/auth/PasswordInput";
import PrimaryButton from "@/components/auth/PrimaryButton";
import Divider from "@/components/auth/Divider";
import GoogleButton from "@/components/auth/GoogleButton";

export default function LoginPage() {
  
 

  const router = useRouter();

  const [touched, setTouched] = useState({
    email: false,
    password: false,
  });

const [errors, setErrors] = useState({
    email: "",
    password: "",
  });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false); 


   const isFormValid =
  email.trim() !== "" &&
  password.trim() !== "" &&
  !errors.email &&
  !errors.password;

 const handleLogin = async () => {

  // Run Validation
  const validationErrors = validateLogin(
    email,
    password
  );

  

  // Save Errors
  setErrors(validationErrors);

  // Stop API call if validation fails
  if (
    validationErrors.email ||
    validationErrors.password
  ) {
    return;
  }
  setLoading(true);

  try {

    const data = await loginUser(email, password);

        localStorage.setItem(
          "access_token",
          data.access_token
        );
        localStorage.setItem("refresh_token", data.refresh_token);

        toast.success("Login successful!", { description: "Welcome back to LegalLens." });
        setTimeout(() => {
          router.push("/dashboard");
        }, 700);

  } catch (error) {

    console.error(error);

    toast.error("Login failed", {
      description: error instanceof Error ? error.message : "Unable to connect to the server. Please try again.",
    });
  }
  finally {
    setLoading(false);
  }
};
  return (
    <AuthLayout>
      <AuthHeader />

      <div className="rounded-2xl border border-black/15 bg-[#EAE6DB] p-6 shadow-lg shadow-black/5">

        {/* Heading */}

        <h2 className="text-2xl font-bold tracking-tight text-[#181211]">
          Welcome back
        </h2>

        <p className="mt-1 text-sm text-[#526174]">
          Log in to continue analyzing your contracts.
        </p>

        {/* Email */}

        <AuthInput
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => {

            const value = e.target.value;

            setEmail(value);

            setTouched({
              ...touched,
              email: true,
            });

            setErrors(
              validateLogin(
                value,
                password
              )
            );

          }}
        />
          <ErrorMessage
            message={
              touched.email
                ? errors.email
                : ""
            }
          />
        {/* Password */}

        <div>

          <PasswordInput
            label="Password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => {

              const value = e.target.value;

              setPassword(value);

              setTouched({
                ...touched,
                password: true,
              });

              setErrors(
                validateLogin(
                  email,
                  value
                )
              );

            }}
            labelAction={<Link href="/forgot-password" className="text-sm font-normal text-[#526174] transition hover:text-[#181211]">Forgot?</Link>}
          />
          <ErrorMessage
            message={
              touched.password
                ? errors.password
                : ""
            }
          />
        </div>
        {/* Login Button */}

          <PrimaryButton
              text={
                loading ? "Logging in..." : "Log in"
              }
              onClick={handleLogin}
              disabled={loading || !isFormValid}
            />

        {/* Divider */}

        <Divider />

        {/* Google */}

        <GoogleButton />

        {/* Signup */}

        <p className="mt-5 text-center text-sm text-[#526174]">
          New to LegalLens?{" "}
          <Link
            href="/signup"
            className="font-semibold text-[#181211] hover:underline"
          >
            Sign up
          </Link>
        </p>

      </div>

    </AuthLayout>
  );
}
