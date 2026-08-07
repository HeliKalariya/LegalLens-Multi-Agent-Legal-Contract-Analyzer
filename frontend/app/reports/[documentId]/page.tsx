"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, FileText } from "lucide-react";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { API_URL, authenticatedFetch } from "@/lib/api";

type Report = {
  summary: {
    filename: string;
    total_pages: number;
    total_clauses: number;
    overall_risk_score: number;
    overall_risk_label: string;
    high_risk_count: number;
    medium_risk_count: number;
    safe_count: number;
    negotiable_count: number;
    analyzed_at: string;
  };
  top_risks: { rank: number; title: string; risk_level: "high" | "medium" | "safe"; page: number; explanation: string }[];
};

/** Final report generated from a completed document analysis. */
export default function GeneratedReportPage() {
  const { documentId } = useParams<{ documentId: string }>();
  const language = useSearchParams().get("language") ?? "en";
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadReport() {
      try {
        const response = await authenticatedFetch(`${API_URL}/api/upload/${documentId}/report?language=${language}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail ?? "Report is not ready yet.");
        setReport(data);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Report is not ready yet.");
      }
    }
    void loadReport();
  }, [documentId, language]);

  return (
    <DashboardLayout>
      <main className="mx-auto w-full max-w-6xl pb-8 text-[#181211]">
        <Link href={`/analysis/${documentId}?language=${language}`} className="inline-flex items-center gap-2 text-sm font-semibold text-[#0875D1] hover:underline"><ArrowLeft className="h-4 w-4" /> Back to analysis</Link>
        {error && <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>}
        {!report && !error && <div className="mt-8 rounded-2xl border border-black/10 bg-[#EAE6DB] p-8 text-sm text-[#67758A]">Loading report...</div>}
        {report && <>
          <header className="mt-8"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#0875D1]">Generated report</p><h1 className="mt-2 break-words text-3xl font-bold sm:text-4xl">{report.summary.filename}</h1><p className="mt-2 text-sm text-[#67758A]">Generated {new Date(report.summary.analyzed_at).toLocaleDateString()} · {report.summary.total_clauses} clauses analyzed</p></header>
          <section className="mt-6 rounded-2xl border border-black/10 bg-[#EAE6DB] p-5 sm:p-7"><div className="flex flex-col gap-5 sm:flex-row sm:items-center"><div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-full border-8 border-[#0875D1] bg-[#F7F3EA] text-center"><span className="text-3xl font-bold">{report.summary.overall_risk_score}<small className="block text-xs font-normal text-[#67758A]">/100 risk</small></span></div><div><span className="rounded-full border border-red-300 bg-red-50 px-3 py-1 text-xs font-bold text-red-700">{report.summary.overall_risk_label}</span><h2 className="mt-4 text-2xl font-bold">Contract risk summary</h2><p className="mt-2 text-sm leading-6 text-[#526174]">This report consolidates the specialist agent findings into the key risks and recommended next steps.</p></div></div></section>
          <section className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">{[["High risk", report.summary.high_risk_count], ["Moderate", report.summary.medium_risk_count], ["Safe", report.summary.safe_count], ["Negotiable", report.summary.negotiable_count]].map(([label, count]) => <div key={String(label)} className="rounded-2xl border border-black/10 bg-[#EAE6DB] p-4"><p className="text-sm text-[#67758A]">{label} clauses</p><p className="mt-3 text-3xl font-bold">{count}</p></div>)}</section>
          <section className="mt-8 rounded-2xl border border-black/10 bg-[#EAE6DB] p-5 sm:p-7"><div className="flex items-center gap-3"><AlertTriangle className="h-6 w-6 text-[#0875D1]" /><h2 className="text-xl font-bold">Top risks</h2></div><div className="mt-5 space-y-3">{report.top_risks.map((risk) => <article key={risk.rank} className="rounded-xl border border-black/10 bg-[#F7F3EA] p-4"><div className="flex gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0875D1] text-sm font-bold text-white">{risk.rank}</span><div><h3 className="font-bold">{risk.title}</h3><p className="mt-1 text-xs text-[#67758A]">Page {risk.page}</p><p className="mt-3 text-sm leading-6 text-[#526174]">{risk.explanation}</p></div></div></article>)}</div></section>
          <section className="mt-8 rounded-2xl border border-black/10 bg-[#EAE6DB] p-5 sm:p-7"><div className="flex items-center gap-3"><FileText className="h-6 w-6 text-[#0875D1]" /><h2 className="text-xl font-bold">Plain English summary</h2></div><p className="mt-4 text-sm leading-7 text-[#526174]">The document has {report.summary.high_risk_count} high-risk and {report.summary.medium_risk_count} moderate-risk clauses. Review the highlighted items carefully, especially before accepting obligations, payment terms, or termination conditions.</p></section>
        </>}
      </main>
    </DashboardLayout>
  );
}
