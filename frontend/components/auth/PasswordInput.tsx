"use client";

import { useState, type ChangeEvent, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";

interface PasswordInputProps {
  label: string;
  placeholder: string;
  name?: string;
  value?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  labelAction?: ReactNode;
}

/** Password field with a visible open/closed eye control. */
export default function PasswordInput({ label, placeholder, name, value, onChange, labelAction }: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <label htmlFor={name} className="text-sm font-semibold text-[#181211]">{label}</label>
        {labelAction}
      </div>
      <div className="relative">
        <input id={name} type={showPassword ? "text" : "password"} name={name} value={value} onChange={onChange} placeholder={placeholder} className="h-11 w-full rounded-xl border border-black/15 bg-[#F1EDE3] px-4 pr-12 text-sm text-[#181211] placeholder:text-[#67758A] outline-none transition focus:border-[#181211] focus:ring-2 focus:ring-black/10" />
        <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#67758A] transition hover:bg-black/5 hover:text-[#181211]">
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
}
