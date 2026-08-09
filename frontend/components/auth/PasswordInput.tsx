"use client";

import { useState } from "react";
import { ReactNode } from "react";

interface PasswordInputProps {
  label: string;
  placeholder: string;
  name?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  labelAction?: ReactNode;
}

export default function PasswordInput({
  label,
  placeholder,
  name,
  value,
  onChange,
  labelAction,
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="mt-4">
      {/* Label */}
      <div className="mb-2 flex items-center justify-between gap-3">
        <label className="text-sm font-semibold text-[#181211]">{label}</label>
        {labelAction}
      </div>

      {/* Password Input */}
      <div className="relative">
        <input
          type={showPassword ? "text" : "password"}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="h-11 w-full rounded-xl border border-black/15 bg-[#F1EDE3] px-4 pr-12 text-sm text-[#181211] placeholder:text-[#67758A] outline-none transition focus:border-[#181211] focus:ring-2 focus:ring-black/10"
        />

        {/* Eye Button */}
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 transition hover:text-black"
        >
          {showPassword ? "🙈" : "👁"}
        </button>
      </div>
    </div>
  );
}
