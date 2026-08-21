"use client";

import Link from "next/link";
import { FileText, LoaderCircle, Moon, Search, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { API_URL, authenticatedFetch } from "@/lib/api";

type SearchDocument = {
  document_id: string;
  original_filename: string;
  document_type?: string;
  analysis_status: string;
  analysis_language?: string;
};

export default function Navbar() {
  const [userName, setUserName] = useState("User");
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchDocument[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    return localStorage.getItem("theme") === "dark" ? "dark" : "light";
  });

  function setPreferredTheme(nextTheme: "light" | "dark") {
    localStorage.setItem("theme", nextTheme);
    setTheme(nextTheme);
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    const savedTheme = localStorage.getItem("theme");
    void authenticatedFetch(`${API_URL}/api/auth/me`)
      .then((response) => response.ok ? response.json() : null)
      .then((profile) => {
        if (cancelled || !profile) return;
        if (typeof profile.full_name === "string" && profile.full_name.trim()) setUserName(profile.full_name.trim());
        if (typeof profile.profile_image === "string" && profile.profile_image) setProfileImage(`${API_URL}${profile.profile_image}`);
        if (savedTheme !== "light" && savedTheme !== "dark") setPreferredTheme(profile.theme === "dark" ? "dark" : "light");
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    let ignore = false;
    const timer = window.setTimeout(() => {
      setIsSearching(true);
      void authenticatedFetch(`${API_URL}/api/upload/search?query=${encodeURIComponent(query)}&limit=6`)
        .then((response) => response.ok ? response.json() : { data: [] })
        .then((payload: { data?: SearchDocument[] }) => {
          if (!ignore) setSearchResults(Array.isArray(payload.data) ? payload.data : []);
        })
        .catch(() => {
          if (!ignore) setSearchResults([]);
        })
        .finally(() => {
          if (!ignore) setIsSearching(false);
        });
    }, 250);

    return () => {
      ignore = true;
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  useEffect(() => {
    function applyProfileUpdate(event: Event) {
      const profile = (event as CustomEvent<{ full_name?: string; profile_image?: string | null }>).detail;
      if (profile.full_name?.trim()) setUserName(profile.full_name.trim());
      setProfileImage(profile.profile_image ? `${API_URL}${profile.profile_image}` : null);
    }
    window.addEventListener("profile-updated", applyProfileUpdate);
    return () => window.removeEventListener("profile-updated", applyProfileUpdate);
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "light" ? "dark" : "light";
    setPreferredTheme(nextTheme);
    void authenticatedFetch(`${API_URL}/api/auth/theme`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: nextTheme }),
    });
  }

  const initials = userName.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "U";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-[#F5F1E9] px-4 pl-16 sm:px-6 sm:pl-16 lg:pl-6">
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
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setShowSuggestions(false);
            }}
            className="h-11 w-full rounded-xl border border-gray-300 bg-[#EAE6DB] pl-11 pr-4 text-sm outline-none transition-all focus:border-black focus:bg-[#EAE6DB]"
          />

          {showSuggestions && searchQuery.trim().length >= 2 && (
            <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-xl border border-gray-200 bg-[#F7F3EA] shadow-lg dark:border-white/15 dark:bg-[#1a1a1a]">
              {isSearching ? (
                <div className="flex items-center gap-2 px-4 py-3 text-sm text-gray-500 dark:text-gray-300">
                  <LoaderCircle size={16} className="animate-spin" /> Searching documents…
                </div>
              ) : searchResults.length ? (
                searchResults.map((document) => (
                  <Link
                    key={document.document_id}
                    href={`/analysis/${document.document_id}?language=${document.analysis_language ?? "en"}`}
                    onClick={() => {
                      setShowSuggestions(false);
                      setSearchQuery("");
                    }}
                    className="flex items-center gap-3 border-b border-gray-200 px-4 py-3 last:border-b-0 transition hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
                      <FileText size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-[#181211] dark:text-white">{document.original_filename}</span>
                      <span className="block truncate text-xs text-gray-500 dark:text-gray-300">
                        {document.document_type ?? "Legal document"} · {document.analysis_status === "analyzed" ? "Analyzed" : "Uploaded"}
                      </span>
                    </span>
                  </Link>
                ))
              ) : (
                <p className="px-4 py-3 text-sm text-gray-500 dark:text-gray-300">No saved documents match “{searchQuery.trim()}”.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Side */}
      <div className="ml-3 flex shrink-0 items-center gap-2 sm:ml-8 sm:gap-5">
        <button
          type="button"
          onClick={toggleTheme}
          className="rounded-lg p-2 transition hover:bg-gray-100"
          aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
          title={theme === "light" ? "Dark theme" : "Light theme"}
        >
          {theme === "light" ? <Moon size={21} /> : <Sun size={21} />}
        </button>

        {/* Divider */}
        <div className="hidden h-7 w-px bg-gray-200 sm:block" />

        {/* User */}
        <button className="flex items-center gap-3 rounded-xl px-2 py-1 transition hover:bg-gray-100">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black text-sm font-semibold text-white">
            {profileImage ? <img src={profileImage} alt="Profile" className="h-full w-full rounded-full object-cover" /> : initials}
          </div>

          <div className="hidden text-left md:block">
            <p className="text-sm font-semibold text-gray-900">
              {userName}
            </p>
          </div>
        </button>
      </div>
    </header>
  );
}
