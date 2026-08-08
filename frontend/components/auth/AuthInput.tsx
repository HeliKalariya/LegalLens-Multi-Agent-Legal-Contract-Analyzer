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
        className="w-full h-11 rounded-xl border border-gray-300 bg-white px-4 pr-12 text-black placeholder:text-gray-500 outline-none transition duration-300 focus:ring-2 focus:ring-black"
      />
    </div>
  );
}