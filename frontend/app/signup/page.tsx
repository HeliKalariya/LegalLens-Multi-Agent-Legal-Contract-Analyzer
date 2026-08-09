  "use client";
  import Link from "next/link";

  import { useState} from "react";
  import { useRouter } from "next/navigation";
  import { registerUser } from "@/services/auth";

  import { validateSignup } from "@/validations/signupValidation";
  import { getPasswordStrength } from "@/utils/passwordStrength";
  import ErrorMessage from "@/components/auth/ErrorMessage";

  import AuthLayout from "@/components/auth/AuthLayout";
  import AuthHeader from "@/components/auth/AuthHeader";
  import AuthInput from "@/components/auth/AuthInput";
  import PasswordInput from "@/components/auth/PasswordInput";
  import PrimaryButton from "@/components/auth/PrimaryButton";
  import Divider from "@/components/auth/Divider";
  import GoogleButton from "@/components/auth/GoogleButton";

  export default function SignupPage() {
    
      const router = useRouter();

    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [backendError, setBackendError] = useState("");
    const [errors, setErrors] = useState({
      fullName: "",
      email: "",
      password: "",
    });
    const passwordStrength = getPasswordStrength(password);
    const isFormValid =
        fullName.trim() !== "" &&
        email.trim() !== "" &&
        password.trim() !== "" &&
        !errors.fullName &&
        !errors.email &&
        !errors.password;
    const [touched, setTouched] = useState({
      fullName: false,
      email: false,
      password: false,
    });
    
    const handleSignup = async () => {

      setBackendError("");

      const validationErrors = validateSignup(
    fullName,
    email,
    password
  );
  
    // Run Validation
    setErrors(validationErrors);

    

    // Stop if there are any errors
    if (
      validationErrors.fullName ||
      validationErrors.email ||
      validationErrors.password
    ) {
      return;
    }

    setLoading(true);

    try {

      await registerUser(
        fullName,
        email,
        password
      );

      alert("Registration Successful!");

      setErrors({
        fullName: "",
        email: "",
        password: "",
      });

      router.push("/login");

    }catch (error) {

    console.error(error);

    const message = error instanceof Error ? error.message : "Could not create account.";
    if (message === "Email already exists") {
      setErrors({ fullName: "", email: message, password: "" });
    } else {
      setBackendError(message);
    }
    
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
            Create your account
          </h2>

          <p className="mt-1 text-sm text-[#526174]">
            Get started free. No credit card required.
          </p>

          <div>
            {/* Full Name */}
            <AuthInput
              label="Name"
              type="text"
              placeholder="Jane Doe"
              name="name"
              value={fullName}
              onChange={(e) => {
                  setFullName(e.target.value);

                  setTouched({
                    ...touched,
                    fullName: true,
                  });
                }}
            />
            <ErrorMessage
              message={
                touched.fullName
                  ? errors.fullName
                  : ""
              }
            />
            {/* Email */}
            <AuthInput
              label="Email"
              type="email"
              placeholder="you@example.com"
              name="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);

                setTouched({
                  ...touched,
                  email: true,
                });
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
            <PasswordInput
              label="Password"
              placeholder="Create a strong password"
              name="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);

                setTouched({
                  ...touched,
                  password: true,
                });
              }}
            />
            <ErrorMessage
                message={
                  touched.password
                    ? errors.password
                    : ""
                }
              />
            {password && (
              <p
                className={`mt-1 text-sm font-medium ${
                  passwordStrength === "Weak"
                    ? "text-red-500"
                    : passwordStrength === "Medium"
                    ? "text-yellow-500"
                    : "text-green-600"
                }`}
              >
                Password Strength: {passwordStrength}
              </p>
            )}
          </div>
          {/* Create Account Button */}

          <div className="mt-5">
            <PrimaryButton
                text={
                    loading
                        ? "Creating Account..."
                        : "Create Account"
                }
                type="button"
                onClick={handleSignup}
                disabled={loading || !isFormValid}
            />
          </div>

          {backendError && (
            <p className="mt-3 rounded-md border border-red-500 bg-red-100 px-3 py-2 text-sm text-red-700">
              {backendError}
            </p>
          )}

          {/* Divider */}

          <div>
            <Divider />
          </div>

          {/* Google Button */}

          <GoogleButton
            text="Sign up with Google"
          />

          {/* Login Link */}

          <p className="mt-5 text-center text-sm text-[#526174]">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-[#181211] hover:underline"
            >
              Log in
            </Link>
          </p>

        </div>

      </AuthLayout>
    );
  }
