// validations/loginValidation.ts

export interface LoginErrors {
  email: string;
  password: string;
}

export function validateLogin(
  email: string,
  password: string
): LoginErrors {

 const errors: LoginErrors = {
    email: "",
    password: "",
};

  // ==========================
  // Email Validation
  // ==========================

  const trimmedEmail = email.trim().toLowerCase();

  if (!trimmedEmail) {
    errors.email = "Email is required.";
  }
  else if (trimmedEmail.length > 254) {
    errors.email = "Email is too long.";
  }
  else if (trimmedEmail.includes(" ")) {
    errors.email = "Email cannot contain spaces.";
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
  else if (trimmedPassword.length < 8) {
    errors.password =
      "Password must be at least 8 characters.";
  }
  else if (trimmedPassword.length > 128) {
    errors.password =
      "Password cannot exceed 128 characters.";
  }

  return errors;
}
