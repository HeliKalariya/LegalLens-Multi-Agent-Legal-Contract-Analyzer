  "use client";
  import Link from "next/link";

  import { useState} from "react";
  import { useRouter } from "next/navigation";
  import { registerUser, signInWithGoogle } from "@/services/auth";
  import { toast } from "sonner";

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
    const [errors, setErrors] = useState({
      fullName: "",
      email: "",
      password: "",
    });
    const passwordStrength = getPasswordStrength(password);
    // Derive button state from the latest field values, not from old error text.
    // This guarantees the button becomes usable as soon as the user fixes an error.
    const currentValidation = validateSignup(fullName, email, password);
    const isFormValid = !currentValidation.fullName && !currentValidation.email && !currentValidation.password;
    const [touched, setTouched] = useState({
      fullName: false,
      email: false,
      password: false,
    });

    function updateSignupField(field: "fullName" | "email" | "password", value: string) {
      const nextFullName = field === "fullName" ? value : fullName;
      const nextEmail = field === "email" ? value : email;
      const nextPassword = field === "password" ? value : password;
      if (field === "fullName") setFullName(value);
      if (field === "email") setEmail(value);
      if (field === "password") setPassword(value);
      setTouched((current) => ({ ...current, [field]: true }));
      setErrors(validateSignup(nextFullName, nextEmail, nextPassword));
    }
    
    const handleSignup = async () => {

      const validationErrors = validateSignup(
    fullName,
    email,
    password
  );
  
    // Run Validation
    setErrors(validationErrors);
    setTouched({ fullName: true, email: true, password: true });

    

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

      toast.success("Account created", { description: "A six-digit verification code was sent to your email." });

      setErrors({
        fullName: "",
        email: "",
        password: "",
      });

      setTimeout(() => router.push(`/verify-email?email=${encodeURIComponent(email)}`), 700);

    }catch (error) {
    const message = error instanceof Error ? error.message : "Could not create account.";
    if (message.includes("already registered")) {
      setErrors({ fullName: "", email: message, password: "" });
    }
    toast.error("Registration failed", { description: message });
    
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
              onChange={(event) => updateSignupField("fullName", event.target.value)}
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
              onChange={(event) => updateSignupField("email", event.target.value)}
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
              onChange={(event) => updateSignupField("password", event.target.value)}
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

          {/* Divider */}

          <div>
            <Divider />
          </div>

          {/* Google Button */}

          <GoogleButton
            text="Sign up with Google"
            onClick={signInWithGoogle}
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
