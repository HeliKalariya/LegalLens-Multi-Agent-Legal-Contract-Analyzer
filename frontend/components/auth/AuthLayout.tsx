import { ReactNode } from "react";

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <main className="h-screen overflow-hidden flex items-center justify-center bg-[#F4EFE6] px-4">
      <div className="w-full max-w-sm">
        {children}
      </div>
    </main>
  );
}