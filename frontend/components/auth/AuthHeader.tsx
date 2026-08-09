import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";

export default function AuthHeader() {
  return (
    <div className="relative  flex min-h-14 items-center justify-center">
      <Link href="/" className="absolute left-0 top-8 inline-flex items-center gap-1 text-xs font-medium text-[#526174] transition hover:text-[#181211]" aria-label="Back to home">
        <ArrowLeft size={16} /> Back to home
      </Link>
      <Link href="/" aria-label="LegalLens home" className="block">
        <Image src="/legallens-logo-transparent.png" alt="LegalLens" width={184} height={72} priority className="theme-logo h-14 w-46 object-contain" />
      </Link>
    </div>
  );
}
