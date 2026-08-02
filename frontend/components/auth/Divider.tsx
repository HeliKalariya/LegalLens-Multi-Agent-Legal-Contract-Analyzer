interface DividerProps {
  text?: string;
}

export default function Divider({
  text = "Or continue with",
}: DividerProps) {
  return (
    <div className="my-3 flex items-center">
      <div className="flex-1 border-t border-gray-300"></div>

      <span className="mx-3 text-xs uppercase tracking-widest text-gray-500">
        {text}
      </span>

      <div className="flex-1 border-t border-gray-300"></div>
    </div>
  );
}