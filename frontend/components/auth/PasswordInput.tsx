"use client";

import { useState } from "react";

interface PasswordInputProps {
  label: string;
  placeholder: string;
  name?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function PasswordInput({
  label,
  placeholder,
  name,
  value,
  onChange,
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="mt-5">
      {/* Label */}
      <label className="block mb-2 font-medium text-black">
        {label}
      </label>

      {/* Password Input */}
      <div className="relative">
        <input
          type={showPassword ? "text" : "password"}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full h-11 rounded-xl border border-gray-300 bg-white px-4 pr-12 text-black placeholder:text-gray-500 outline-none transition duration-300 focus:ring-2 focus:ring-black"
        />

        {/* Eye Button */}
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black"
        >
          {showPassword ? "🙈" : "👁"}
        </button>
      </div>
    </div>
  );
}