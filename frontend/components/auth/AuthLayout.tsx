import { ReactNode } from "react";

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <main className="flex h-dvh items-center justify-center overflow-hidden bg-[#F7F3EA] px-4 py-3 text-[#181211]">
      <div className="w-full max-w-md">
        {children}
      </div>
    </main>
  );
}
