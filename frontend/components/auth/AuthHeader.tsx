import Link from "next/link";

export default function AuthHeader() {
  return (
    <div className="mb-4 text-center">
      <Link href="/">
        <h1 className="text-2xl font-bold text-black cursor-pointer">
          Legal Lens
        </h1>
      </Link>

      <p className="mt-1 text-xs text-gray-600">
        AI Powered Legal Document Analysis
      </p>
    </div>
  );
}