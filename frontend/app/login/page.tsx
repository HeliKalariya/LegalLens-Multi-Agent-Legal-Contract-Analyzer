"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginUser } from "@/services/auth";
/* eslint-disable react/no-unescaped-entities */
import Link from "next/link";

import { validateLogin } from "@/validations/loginValidation";
import ErrorMessage from "@/components/auth/ErrorMessage";

import AuthLayout from "@/components/auth/AuthLayout";
import AuthHeader from "@/components/auth/AuthHeader";
import AuthInput from "@/components/auth/AuthInput";
import PasswordInput from "@/components/auth/PasswordInput";
import PrimaryButton from "@/components/auth/PrimaryButton";
import Divider from "@/components/auth/Divider";
import GoogleButton from "@/components/auth/GoogleButton";
import BackHome from "@/components/auth/BackHome";

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

  const [successMessage, setSuccessMessage] = useState("");
  const [backendError, setBackendError] = useState("");
  const [loading, setLoading] = useState(false); 


   const isFormValid =
  email.trim() !== "" &&
  password.trim() !== "" &&
  !errors.email &&
  !errors.password;

 const handleLogin = async () => {

  setBackendError("");
  setSuccessMessage("");

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

      setSuccessMessage("Login Successful!");

        localStorage.setItem(
          "access_token",
          data.access_token
        );

        setTimeout(() => {
          router.push("/upload");
        }, 1500);

  } catch (error) {

    console.error(error);

    setBackendError(
      error instanceof Error
        ? error.message
        : "Unable to connect to the server. Please try again."
    );
  }
  finally {
    setLoading(false);
  }
};
  return (
    <AuthLayout>
      <AuthHeader />

      <div className="bg-[#F5F1E8] border border-gray-300 rounded-xl shadow-md p-4">

        {/* Heading */}

        <h2 className="text-xl font-bold text-black">
          Welcome Back
        </h2>

        <p className="mt-1 text-[11px] leading-4 text-gray-600">
          Log in to continue analyzing your legal documents.
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

          <div className="flex justify-end mt-2 mb-1">

            <Link
              href="/forgot-password"
              className="text-sm text-gray-600 hover:text-black"
            >
              Forgot Password?
            </Link>

          </div>

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
          />
          <ErrorMessage
            message={
              touched.password
                ? errors.password
                : ""
            }
          />
        </div>
        {
          successMessage && (
            <div className="mb-3 rounded-md bg-green-100 border border-green-500 px-3 py-2 text-sm text-green-700">
              {successMessage}
            </div>
          )
        }
        {
            backendError && (
              <div className="mb-3 rounded-md border border-red-500 bg-red-100 px-3 py-2 text-sm text-red-700">
                {backendError}
              </div>
            )
          }
        {/* Login Button */}

          <PrimaryButton
              text={
                loading
                  ? "Logging in..."
                  : "Login"
              }
              onClick={handleLogin}
              disabled={loading || !isFormValid}
            />

        {/* Divider */}

        <Divider />

        {/* Google */}

        <GoogleButton />

        {/* Signup */}

        <p className="mt-3 text-center text-sm text-gray-700">
          Don't have an account?{" "}
          <Link
            href="/signup"
            className="font-semibold text-black hover:underline"
          >
            Sign Up
          </Link>
        </p>

      </div>

      <BackHome />

    </AuthLayout>
  );
}
