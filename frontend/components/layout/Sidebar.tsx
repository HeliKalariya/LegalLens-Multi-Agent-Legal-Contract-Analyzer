"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Upload,
  Bot,
  UserRound,
  LogOut,
  Menu,
  X,
} from "lucide-react";

const menuItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Documents",
    href: "/documents",
    icon: FileText,
  },
  {
    title: "Upload",
    href: "/upload",
    icon: Upload,
  },
  {
    title: "AI Chat",
    href: "/ai-chat",
    icon: Bot,
  },
  {
    title: "Profile",
    href: "/profile",
    icon: UserRound,
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  function logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setIsOpen(false);
    router.push("/login");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Open navigation menu"
        className="fixed left-3 top-3 z-50 rounded-xl border border-gray-200 bg-[#F5F1E9] p-2 text-black shadow-sm lg:hidden"
      >
        <Menu size={22} />
      </button>

      {isOpen && <button type="button" aria-label="Close navigation menu" onClick={() => setIsOpen(false)} className="fixed inset-0 z-40 bg-black/40 lg:hidden" />}

      <aside className={`theme-sidebar fixed inset-y-0 left-0 z-50 flex h-screen w-68 -translate-x-full flex-col border-r border-gray-200 bg-[#EAE6DB] transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:translate-x-0 ${isOpen ? "translate-x-0" : ""}`}>
      {/* Logo */}
      <div className="flex h-20 items-center justify-center border-b border-gray-200 px-2">
        <img src="/legallens-logo-transparent.png" alt="LegalLens" className="theme-logo h-20 w-60 object-contain" />
        <button type="button" onClick={() => setIsOpen(false)} aria-label="Close navigation menu" className="absolute right-3 top-3 rounded-lg p-2 hover:bg-black/5 lg:hidden"><X size={20} /></button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-4">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;

            const active =
              pathname === item.href ||
              pathname.startsWith(item.href + "/");

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`sidebar-nav-link flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                    active
                      ? "sidebar-nav-active bg-[#F5F1E9] text-black shadow-sm"
                      : "text-gray-600 hover:bg-[#F5F1E9] hover:text-black"
                  }`}
                >
                  <Icon size={20} />

                  <span>{item.title}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-gray-200 p-4">
        <button
          type="button"
          onClick={logout}
          className="sidebar-logout flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-gray-600 transition hover:bg-red-50 hover:text-red-600"
        >
          <LogOut size={20} />
          <span>Log out</span>
        </button>
      </div>

      </aside>
    </>
  );
}
