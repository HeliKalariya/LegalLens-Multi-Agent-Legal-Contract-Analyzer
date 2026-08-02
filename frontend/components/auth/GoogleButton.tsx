import Image from "next/image";

interface GoogleButtonProps {
  text?: string;
  onClick?: () => void;
}

export default function GoogleButton({
  text = "Continue with Google",
  onClick,
}: GoogleButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white py-2 text-sm font-medium text-black transition hover:bg-gray-100"
    >
      <Image
        src="/google.svg"
        alt="Google Logo"
        width={18}
        height={18}
      />

      <span className="font-medium text-black">
        {text}
      </span>
    </button>
  );
}