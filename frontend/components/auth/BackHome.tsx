import Link from "next/link";

interface BackHomeProps {
  href?: string;
  text?: string;
}

export default function BackHome({
  href = "/",
  text = "← Back to Home",
}: BackHomeProps) {
  return (
    <div className="text-center mt-6">
      <Link
        href={href}
        className="
          text-sm
          text-gray-600
          hover:text-black
          transition-colors
          duration-300
        "
      >
        {text}
      </Link>
    </div>
  );
}