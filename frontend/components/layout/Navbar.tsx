"use client";

import { Bell, Search, ChevronDown } from "lucide-react";
import Image from "next/image";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-gray-200 bg-[#F5F1E9] px-6">
      {/* Search */}
      <div className="flex flex-1 max-w-2xl">
        <div className="relative w-full">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            size={18}
          />

          <input
            type="text"
            placeholder="Search documents, clauses, reports..."
            className="h-11 w-full rounded-xl border border-gray-300 bg-[#EAE6DB] pl-11 pr-4 text-sm outline-none transition-all focus:border-black focus:bg-[#EAE6DB]"
          />
        </div>
      </div>

      {/* Right Side */}
      <div className="ml-8 flex items-center gap-5">
        {/* Notification */}
        <button className="relative rounded-lg p-2 transition hover:bg-gray-100">
          <Bell size={21} />

          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-blue-600" />
        </button>

        {/* Divider */}
        <div className="h-7 w-px bg-gray-200" />

        {/* User */}
        <button className="flex items-center gap-3 rounded-xl px-2 py-1 transition hover:bg-gray-100">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black text-sm font-semibold text-white">
            JD
          </div>

          <div className="hidden text-left md:block">
            <p className="text-sm font-semibold text-gray-900">
              Jane Doe
            </p>

            <p className="text-xs text-gray-500">
              Administrator
            </p>
          </div>

          <ChevronDown
            size={18}
            className="hidden text-gray-500 md:block"
          />
        </button>
      </div>
    </header>
  );
}