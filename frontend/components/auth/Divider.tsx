interface DividerProps {
  text?: string;
}

export default function Divider({
  text = "Or continue with",
}: DividerProps) {
  return (
    <div className="my-3 flex items-center">
      <div className="flex-1 border-t border-black/15"></div>

      <span className="mx-2 text-[10px] uppercase tracking-wide text-[#526174]">
        {text}
      </span>

      <div className="flex-1 border-t border-black/15"></div>
    </div>
  );
}
