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
      className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-black/15 bg-[#F7F3EA] text-xs font-semibold text-[#181211] shadow-sm transition hover:bg-white"
    >
      <Image
        src="/google.svg"
        alt="Google Logo"
        width={18}
        height={18}
      />

      <span className="font-semibold text-[#181211]">
        {text}
      </span>
    </button>
  );
}
