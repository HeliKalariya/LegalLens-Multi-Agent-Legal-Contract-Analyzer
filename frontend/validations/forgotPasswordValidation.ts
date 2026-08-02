// validations/forgotPasswordValidation.ts

export interface ForgotPasswordErrors {
  email?: string;
}

export function validateForgotPassword(
  email: string
): ForgotPasswordErrors {

  const errors: ForgotPasswordErrors = {};

  // ==========================
  // Email Validation
  // ==========================

  const trimmedEmail = email.trim().toLowerCase();

  if (!trimmedEmail) {
    errors.email = "Email is required.";
  } else if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)
  ) {
    errors.email = "Enter a valid email address.";
  }

  return errors;
}