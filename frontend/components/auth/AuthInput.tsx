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
    <div className="mt-3">
      <label
        htmlFor={name}
        className="mb-1 block text-sm font-medium text-black"
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
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-black placeholder-gray-500 outline-none transition-all duration-200 focus:border-black focus:ring-2 focus:ring-gray-300"
      />
    </div>
  );
}