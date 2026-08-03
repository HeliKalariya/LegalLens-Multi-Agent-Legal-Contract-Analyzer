// validations/signupValidation.ts

export interface SignupErrors {
  fullName: string;
  email: string;
  password: string;
}

export function validateSignup(
  fullName: string,
  email: string,
  password: string
): SignupErrors {

  const errors: SignupErrors = {
  fullName: "",
  email: "",
  password: "",
};

  // ==========================
  // Full Name Validation
  // ==========================

  const trimmedName = fullName
  .trim()
  .replace(/\s+/g, " ");

  if (!trimmedName) {
    errors.fullName = "Full name is required.";
  } else if (trimmedName.length < 3) {
    errors.fullName = "Full name must be at least 3 characters.";
  } else if (trimmedName.length > 100) {
    errors.fullName = "Full name cannot exceed 100 characters.";
  } else if (!/^[A-Za-z ]+$/.test(trimmedName)) {
    errors.fullName =
      "Full name can contain only letters and spaces.";
  }

  // ==========================
  // Email Validation
  // ==========================

  const trimmedEmail = email.trim().toLowerCase();

if (!trimmedEmail) {

  errors.email = "Email is required.";

}
else if (trimmedEmail.includes(" ")) {

  errors.email = "Email cannot contain spaces.";

}
else if (trimmedEmail.length > 254) {

  errors.email = "Email cannot exceed 254 characters.";

}
else if (
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)
) {

  errors.email = "Enter a valid email address.";

}

  // ==========================
// Password Validation
// ==========================

const trimmedPassword = password.trim();

if (!trimmedPassword) {

  errors.password = "Password is required.";

}
else if (password !== trimmedPassword) {

  errors.password =
    "Password cannot start or end with spaces.";

}
else if (trimmedPassword.length < 8) {

  errors.password =
    "Password must be at least 8 characters.";

}
else if (trimmedPassword.length > 128) {

  errors.password =
    "Password cannot exceed 128 characters.";

}
else if (!/[A-Z]/.test(trimmedPassword)) {

  errors.password =
    "Password must contain at least one uppercase letter.";

}
else if (!/[a-z]/.test(trimmedPassword)) {

  errors.password =
    "Password must contain at least one lowercase letter.";

}
else if (!/[0-9]/.test(trimmedPassword)) {

  errors.password =
    "Password must contain at least one number.";

}
else if (!/[!@#$%^&*(),.?":{}|<>]/.test(trimmedPassword)) {

  errors.password =
    "Password must contain at least one special character.";

}

  return errors;
}
