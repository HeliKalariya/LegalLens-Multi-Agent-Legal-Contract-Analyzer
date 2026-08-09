interface PrimaryButtonProps {
  text: string;
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
  disabled?: boolean;
}

export default function PrimaryButton({
  text,
  onClick,
  type = "button",
  disabled = false,
}: PrimaryButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`
        mt-3
        w-full
        rounded-lg
        auth-primary
        bg-[#181211]
        py-2
        text-sm
        font-semibold
        text-white
        transition-all
        duration-200

        ${
          disabled
            ? "opacity-60 cursor-not-allowed"
            : "hover:bg-black active:scale-[0.99]"
        }
      `}
    >
      {text}
    </button>
  );
}
