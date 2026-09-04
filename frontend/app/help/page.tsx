"use client";

import { Bot, FileSearch, FileText, Lightbulb, MousePointer2, Search, ShieldCheck, Sparkles } from "lucide-react";

import DashboardLayout from "@/components/layout/DashboardLayout";

const examples = ["termination", "security deposit", "late fee", "liability"];

const searchTargets = [
  { icon: FileText, title: "Document name", example: "Rental agreement" },
  { icon: FileSearch, title: "Clause title", example: "Termination notice" },
  { icon: Search, title: "Clause content", example: "Landlord may enter" },
  { icon: ShieldCheck, title: "Risk or negotiation note", example: "financial burden" },
];

const projectSteps = [
  { icon: FileText, title: "1. Upload", body: "Add a PDF or DOCX legal document and choose your preferred language." },
  { icon: Sparkles, title: "2. AI analysis", body: "LegalLens extracts important clauses and reviews possible risks." },
  { icon: ShieldCheck, title: "3. Understand risks", body: "Read simple explanations, risk reasons, and negotiation suggestions." },
  { icon: FileSearch, title: "4. Search & review", body: "Find a saved document or clause whenever you need it." },
  { icon: Bot, title: "5. Ask LegalLens AI", body: "Ask questions about the selected contract in a chat conversation." },
];

export default function HelpPage() {
  function trySearch(value = "") {
    // The header owns the actual search input, so this event focuses it and can
    // optionally insert one of the examples without duplicating search logic.
    window.dispatchEvent(new CustomEvent("focus-global-search", { detail: { query: value } }));
  }

  return (
    <DashboardLayout>
      <main className="mx-auto w-full max-w-6xl text-[#181211]">
        <section className="overflow-hidden rounded-3xl border border-[#0875D1]/20 bg-[#EAF4FE] p-6 sm:p-9">
          <div className="grid gap-7 lg:grid-cols-[1.2fr_.8fr] lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#0875D1]">LegalLens guide</p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Find any clause in seconds</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[#35465D] sm:text-base">Use the search bar at the top of every page to find a saved document or an exact clause inside it. Search stays private: it only looks through documents you uploaded.</p>
              <button type="button" onClick={() => trySearch()} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#181211] px-5 py-3 text-sm font-semibold text-white">
                <Search className="h-4 w-4" /> Try global search
              </button>
            </div>
            <div className="rounded-2xl border border-[#0875D1]/15 bg-[#F7F3EA] p-5 shadow-sm">
              <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-100 text-[#0875D1]"><FileSearch className="h-5 w-5" /></span><div><p className="font-bold">Search result</p><p className="text-sm text-[#526174]">Opens the exact clause</p></div></div>
              <div className="mt-5 rounded-xl border border-black/10 bg-[#EAE6DB] p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-[#0875D1]">Clause · Page 2</p>
                <p className="mt-1 font-semibold">Security Deposit</p>
                <p className="mt-1 text-sm text-[#526174]">Rental_Agreement.docx</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-7 rounded-2xl border border-black/10 bg-[#EAE6DB] p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#0875D1]">Quick project tour</p><h2 className="mt-2 text-xl font-bold">What LegalLens does</h2></div><p className="max-w-lg text-sm leading-6 text-[#526174]">LegalLens helps you review legal documents faster. It highlights clauses that may need attention, explains them in simple language, and helps you prepare for negotiation.</p></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {projectSteps.map((step) => { const Icon = step.icon; return <article key={step.title} className="relative rounded-xl border border-black/10 bg-[#F7F3EA] p-4"><span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-[#0875D1]"><Icon className="h-4 w-4" /></span><h3 className="mt-3 text-sm font-bold">{step.title}</h3><p className="mt-1.5 text-sm leading-6 text-[#526174]">{step.body}</p></article>; })}
          </div>
        </section>

        <section className="mt-7">
          <div className="flex items-end justify-between gap-4"><div><h2 className="text-xl font-bold">How search works</h2><p className="mt-1 text-sm text-[#526174]">Three quick steps—no special legal wording is required.</p></div><span className="hidden rounded-full bg-[#EAE6DB] px-3 py-1.5 text-xs font-semibold text-[#526174] sm:block">Minimum 2 letters</span></div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {[
              { number: "1", icon: Search, title: "Type a word", body: "Use the search bar in the top header. Try a file name, clause name, or a phrase from the contract." },
              { number: "2", icon: FileSearch, title: "Choose a result", body: "Results identify whether you found a document or a clause, and show the source document." },
              { number: "3", icon: MousePointer2, title: "Review the clause", body: "Click a clause result to open its document with that clause expanded for review." },
            ].map((step) => {
              const Icon = step.icon;
              return <article key={step.number} className="rounded-2xl border border-black/10 bg-[#EAE6DB] p-5"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#181211] text-sm font-bold text-white">{step.number}</span><Icon className="mt-5 h-5 w-5 text-[#0875D1]" /><h3 className="mt-3 font-bold">{step.title}</h3><p className="mt-2 text-sm leading-6 text-[#526174]">{step.body}</p></article>;
            })}
          </div>
        </section>

        <section className="mt-7 grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
          <article className="rounded-2xl border border-black/10 bg-[#EAE6DB] p-5 sm:p-6">
            <h2 className="text-xl font-bold">What you can search</h2>
            <div className="mt-4 overflow-hidden rounded-xl border border-black/10 bg-[#F7F3EA]">
              <div className="grid grid-cols-[auto_1fr_1fr] gap-3 border-b border-black/10 bg-[#DDD8CF] px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#526174]"><span></span><span>Search for</span><span>Example</span></div>
              {searchTargets.map((target) => { const Icon = target.icon; return <div key={target.title} className="grid grid-cols-[auto_1fr_1fr] items-center gap-3 border-b border-black/10 px-4 py-3 last:border-b-0"><span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-[#0875D1]"><Icon className="h-4 w-4" /></span><span className="text-sm font-semibold">{target.title}</span><span className="truncate text-sm text-[#526174]">{target.example}</span></div>; })}
            </div>
          </article>

          <article className="rounded-2xl border border-black/10 bg-[#EAE6DB] p-5 sm:p-6">
            <div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700"><Lightbulb className="h-5 w-5" /></span><div><h2 className="text-xl font-bold">Try these examples</h2><p className="mt-1 text-sm leading-6 text-[#526174]">Click an example to fill the top search field and view matching results.</p></div></div>
            <div className="mt-5 flex flex-wrap gap-2">
              {examples.map((example) => <button key={example} type="button" onClick={() => trySearch(example)} className="rounded-full border border-[#0875D1]/25 bg-[#F7F3EA] px-3.5 py-2 text-sm font-medium text-[#35465D] hover:border-[#0875D1] hover:text-[#0875D1]">{example}</button>)}
            </div>
            <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm leading-6 text-green-900"><span className="font-bold">Privacy note: </span>Search only uses your own saved documents and their completed analyses. It never searches another user&apos;s records.</div>
          </article>
        </section>
      </main>
    </DashboardLayout>
  );
}
