import Link from "next/link";
import Image from "next/image";

export default function AuthHeader() {
  return (
    <div className="mb-4 flex justify-center">
      <Link href="/" aria-label="LegalLens home" className="block">
        <Image src="/legallens-logo-transparent.png" alt="LegalLens" width={152} height={56} priority className="theme-logo h-12 w-38 object-contain" />
      </Link>
    </div>
  );
}
