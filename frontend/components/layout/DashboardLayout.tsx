"use client";

import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    // A dashboard route is only available when the browser has a saved session.
    const accessToken = localStorage.getItem("access_token");
    const refreshToken = localStorage.getItem("refresh_token");
    if (!accessToken && !refreshToken) router.replace("/login");
  }, [router]);

  return (
    <div className="flex min-h-screen bg-[#F5F1E9]">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar />

        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
