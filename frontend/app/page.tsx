"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  BriefcaseBusiness,
  CheckCircle2,
  FileText,
  Handshake,
  House,
  Languages,
  Landmark,
  MessageSquare,
  Moon,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Sun,
  ScrollText,
  Upload,
} from "lucide-react";

const features = [
  { icon: ScanSearch, title: "Clause Detection", text: "Automatically identify every clause: termination, indemnity, liability, IP, renewal, and 40+ more." },
  { icon: ShieldCheck, title: "Risk Analysis", text: "Every clause is scored with a clear red, yellow, or green risk badge." },
  { icon: Languages, title: "Plain English", text: "Legal jargon rewritten as short, unambiguous sentences a human can actually read." },
  { icon: MessageSquare, title: "Negotiation Suggestions", text: "Concrete redline suggestions and counter-language you can use in a reply." },
  { icon: FileText, title: "AI Report Generation", text: "One-click report with an executive summary, top risks, and recommended next steps." },
  { icon: Sparkles, title: "Ask Anything", text: "Chat with your contract and get answers grounded in your document." },
];

const steps = [
  ["01", "Upload document", "Drop a PDF or DOCX. Nothing leaves your workspace."],
  ["02", "AI extracts clauses", "Every clause is parsed, labeled, and cross-referenced."],
  ["03", "Detect risks", "Each clause is scored against benchmark contracts."],
  ["04", "Simplify language", "Every clause is rewritten in plain English, side-by-side."],
  ["05", "Download report", "Share a polished report with your team or counterparty."],
];

const documentTypes = [
  { icon: House, title: "Leases & rental agreements", text: "Security deposits, break-lease clauses, and what your landlord can and cannot do." },
  { icon: BriefcaseBusiness, title: "Job offers & employment", text: "Non-competes, NDAs, severance, equity vesting, and at-will language." },
  { icon: ScrollText, title: "Terms of service", text: "Understand what you are agreeing to when you accept online terms." },
  { icon: Landmark, title: "Loans & financial agreements", text: "Interest rates, late fees, prepayment penalties, and missed-payment terms." },
  { icon: FileText, title: "Service & membership contracts", text: "Subscriptions, memberships, phone plans, and cancellation conditions." },
  { icon: Handshake, title: "Personal agreements", text: "Roommate contracts, freelance work, contractor quotes, and settlement offers." },
];

export default function Home() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    return localStorage.getItem("theme") === "dark" ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  function toggleTheme() {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.style.colorScheme = nextTheme;
  }

  return (
    <main className="min-h-screen bg-[#F7F3EA] text-[#181211]">
      <header className="sticky top-0 z-20 border-b border-black/10 bg-[#F7F3EA]/95 backdrop-blur">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:h-20 sm:px-6">
          <Link href="/" className="block" aria-label="LegalLens home">
            <img src="/legallens-logo-transparent.png" alt="LegalLens" className="theme-logo h-11 w-32 object-contain sm:h-16 sm:w-56" />
          </Link>
          <div className="hidden items-center gap-10 text-sm font-medium text-gray-600 md:flex">
            <a href="#document-types" className="hover:text-black">Documents</a>
            <a href="#features" className="hover:text-black">Features</a>
            <a href="#how-it-works" className="hover:text-black">How it works</a>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-xs font-semibold sm:gap-3 sm:text-sm">
            <button type="button" onClick={toggleTheme} className="grid h-9 w-9 place-items-center rounded-lg border border-black/15 bg-white/50 text-[#181211] transition hover:bg-white sm:h-10 sm:w-10" aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"} title={theme === "light" ? "Dark mode" : "Light mode"}>
              {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <Link href="/login" className="inline-flex rounded-lg border border-black/15 bg-white/50 px-3 py-2 hover:bg-white sm:px-4">Log in</Link>
          </div>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-8 text-center sm:px-6 sm:pb-28 sm:pt-10">
        <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-black/15 px-3  text-xs text-gray-600 sm:px-4 sm:text-sm"><span className="h-2 w-2 rounded-full bg-[#0877cb]" /> AI-powered legal document analysis</p>
        <h1 className="mx-auto mt-7 max-w-4xl text-4xl font-bold leading-[0.98] tracking-tight sm:mt-9 sm:text-7xl">
          Understand every contract <em className="font-bold text-[#0877cb]">before</em> you sign.
        </h1>
        <p className="mx-auto mt-8 max-w-3xl text-lg leading-8 text-gray-600 sm:text-xl">ContractIQ reads your contracts the way a senior lawyer would — highlighting risks, rewriting legalese in plain English, and telling you exactly what to negotiate.</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:mt-10 sm:flex-row">
          <Link href="/login" className="inline-flex items-center justify-center gap-3 rounded-xl bg-[#181211] px-6 py-3 text-sm font-semibold text-white hover:bg-black sm:px-7 sm:py-4 sm:text-base"><Upload size={19} /> Upload contract</Link>
          <a href="#features" className="rounded-xl border border-black/15 bg-white/40 px-6 py-3 text-sm font-semibold hover:bg-white sm:px-7 sm:py-4 sm:text-base">Learn more</a>
        </div>
        <div className="mt-7 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-gray-600 sm:mt-9 sm:gap-x-7 sm:gap-y-3 sm:text-sm">
          {["No card required", "SOC 2 aligned", "PDF & DOCX"].map((item) => <span key={item} className="inline-flex items-center gap-2"><CheckCircle2 size={17} className="text-[#0877cb]" />{item}</span>)}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6 sm:pb-24" aria-label="Contract analysis preview">
        <div className="lg:rounded-[2rem] lg:border lg:border-black/15 lg:bg-[#F1EDE3] lg:p-6 lg:shadow-xl lg:shadow-black/5">
          <div className="grid gap-5 rounded-[1.5rem] border border-black/15 bg-[#F7F3EA] p-5 md:grid-cols-2">
            <article className="rounded-2xl border border-black/15 bg-[#F1EDE3] p-6 text-left">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-gray-500"><span>Clause 4.2 — Termination</span><span className="rounded-full border border-red-300 bg-red-50 px-4 py-1 text-red-700">High Risk</span></div>
              <p className="mt-5 text-lg leading-8">“Either party may terminate this Agreement upon <mark className="rounded bg-red-100 px-1">no less than ninety (90) days&apos; written notice</mark>, provided that the Client shall remain liable for all fees accrued through the effective date.”</p>
              <div className="mt-5 rounded-xl border border-black/15 bg-[#F7F3EA] p-4"><p className="font-semibold">Plain English</p><p className="mt-2 text-gray-600">You need to give 90 days notice to cancel, and you still owe money accrued up to that date.</p></div>
            </article>
            <div className="space-y-3">
              {[ ["Liability cap", "High Risk", "border-red-300 bg-red-50 text-red-700"], ["Auto-renewal", "Moderate", "border-amber-300 bg-amber-50 text-amber-800"], ["IP assignment", "Safe", "border-green-300 bg-green-50 text-green-700"], ["Confidentiality", "Safe", "border-green-300 bg-green-50 text-green-700"] ].map(([title, risk, color]) => (
                <div key={title} className="flex items-center justify-between rounded-2xl border border-black/15 bg-[#F1EDE3] px-5 py-5"><span className="font-semibold">{title}</span><span className={`rounded-full border px-3 py-1 text-sm ${color}`}>{risk}</span></div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="document-types" className="border-y border-black/10 bg-[#F1EDE3] py-16 sm:py-24" aria-labelledby="document-types-heading">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-wider text-[#0877cb]">Supported documents</p>
            <h2 id="document-types-heading" className="mt-3 text-3xl font-bold tracking-tight text-[#181211] sm:text-5xl">Documents we help you understand</h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-[#67758A] sm:text-base">If someone is asking you to sign it, LegalLens can help you read it with confidence.</p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {documentTypes.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-2xl border border-black/15 bg-[#F7F3EA] p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <span className="grid h-11 w-11 place-items-center rounded-xl border border-[#0877cb]/20 bg-[#0877cb]/10 text-[#0877cb]"><Icon size={24} /></span>
                <h3 className="mt-5 text-lg font-bold text-[#181211]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#67758A]">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-10">
        <p className="text-sm font-bold uppercase tracking-wider text-[#0877cb]">Features</p>
        <h2 className="mt-4 max-w-4xl text-3xl font-bold leading-tight tracking-tight sm:text-6xl">Everything you need to read a contract with confidence.</h2>
        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, text }) => <article key={title} className="rounded-3xl border border-black/15 bg-[#F1EDE3] p-7"><span className="inline-flex rounded-xl border border-black/15 bg-[#F7F3EA] p-3 text-[#0877cb]"><Icon size={25} /></span><h3 className="mt-7 text-xl font-bold">{title}</h3><p className="mt-3 leading-7 text-gray-600">{text}</p></article>)}
        </div>
      </section>

      <section id="how-it-works" className="border-y border-black/10 bg-[#F1EDE3] py-16 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <p className="text-sm font-bold uppercase tracking-wider text-[#0877cb]">How it works</p>
          <h2 className="mt-4 max-w-3xl text-3xl font-bold leading-tight tracking-tight sm:text-6xl">From upload to report in under two minutes.</h2>
          <div className="mt-14 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {steps.map(([number, title, text]) => <article key={number} className="min-h-52 rounded-3xl border border-black/15 bg-[#F7F3EA] p-7"><span className="font-mono text-sm font-bold text-[#0877cb]">{number}</span><h3 className="mt-5 text-lg font-bold">{title}</h3><p className="mt-3 leading-6 text-gray-600">{text}</p></article>)}
          </div>
        </div>
      </section>

      <footer className="border-t border-black/10 py-8 text-center text-sm text-gray-600">© LegalLens. All rights reserved.</footer>
    </main>
  );
}
