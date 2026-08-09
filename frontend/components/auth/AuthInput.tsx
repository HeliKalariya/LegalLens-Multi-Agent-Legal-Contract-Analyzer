import React from "react";

interface AuthInputProps {
  label: string;
  type: string;
  placeholder: string;
  name?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function AuthInput({
  label,
  type,
  placeholder,
  name,
  value,
  onChange,
}: AuthInputProps) {
  return (
    <div className="mt-4">
      <label
        htmlFor={name}
        className="mb-2 block text-sm font-semibold text-[#181211]"
      >
        {label}
      </label>

      <input
        id={name}
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="h-11 w-full rounded-xl border border-black/15 bg-[#F1EDE3] px-4 text-sm text-[#181211] placeholder:text-[#67758A] outline-none transition focus:border-[#181211] focus:ring-2 focus:ring-black/10"
      />
    </div>
  );
}
