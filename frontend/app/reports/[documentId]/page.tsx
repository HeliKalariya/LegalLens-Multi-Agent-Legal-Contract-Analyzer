"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, Download, FileText, Handshake, LoaderCircle } from "lucide-react";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { API_URL, authenticatedFetch } from "@/lib/api";
import { readPageCache, writePageCache } from "@/lib/client-cache";

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
  negotiation_terms?: { title: string; page: number; suggestion: string }[];
  contract_summary?: string[];
};

type OverallRiskLevel = "safe" | "medium" | "high";

/** Keep stored reports visually consistent when the score bands change. */
function getOverallRisk(score: number): { level: OverallRiskLevel; label: string; color: string; badgeClass: string } {
  if (score >= 75) return { level: "high", label: "High risk", color: "#DC2626", badgeClass: "border-red-300 bg-red-50 text-red-700" };
  if (score >= 45) return { level: "medium", label: "Moderate risk", color: "#CA8A04", badgeClass: "border-yellow-300 bg-yellow-50 text-yellow-800" };
  return { level: "safe", label: "Safe", color: "#16A34A", badgeClass: "border-green-300 bg-green-50 text-green-700" };
}

function getClauseBadgeClass(level: Report["top_risks"][number]["risk_level"]) {
  return level === "high" ? "border-red-300 bg-red-50 text-red-700" : level === "medium" ? "border-yellow-300 bg-yellow-50 text-yellow-800" : "border-green-300 bg-green-50 text-green-700";
}

function fallbackContractSummary(summary: Report["summary"]): string[] {
  return [
    `This report reviews ${summary.filename}, which contains ${summary.total_pages} page(s) and ${summary.total_clauses} extracted clause(s).`,
    `Its overall risk score is ${summary.overall_risk_score}/100, reflecting the balance of obligations, costs, remedies, and exit rights.`,
    `The review found ${summary.high_risk_count} high-risk clause(s), ${summary.medium_risk_count} moderate clause(s), and ${summary.safe_count} comparatively safe clause(s).`,
    "Read the payment, liability, termination, renewal, confidentiality, and dispute provisions together because they can affect each other in practice.",
    "Confirm that all dates, notice periods, fees, and responsibilities match the commercial agreement between the parties.",
    "Use the negotiation terms below to raise specific changes or clarifications before signing.",
    "Where the financial or legal impact is significant, obtain professional legal advice before accepting the final document.",
  ];
}

/** Final report generated from a completed document analysis. */
export default function GeneratedReportPage() {
  const { documentId } = useParams<{ documentId: string }>();
  const language = useSearchParams().get("language") ?? "en";
  const languageName = { en: "English", hi: "Hindi", gu: "Gujarati", es: "Spanish", fr: "French" }[language] ?? "English";
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const score = Math.max(0, Math.min(100, report?.summary.overall_risk_score ?? 0));
  const overallRisk = getOverallRisk(score);
  const summaryLines = report?.contract_summary?.length ? report.contract_summary : report ? fallbackContractSummary(report.summary) : [];

  useEffect(() => {
    const cacheKey = `report:${documentId}:${language}`;
    const cachedReport = readPageCache<Report>(cacheKey, 5 * 60_000);
    if (cachedReport) queueMicrotask(() => setReport(cachedReport));

    async function loadReport() {
      try {
        const response = await authenticatedFetch(`${API_URL}/api/upload/${documentId}/report?language=${language}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail ?? "Report is not ready yet.");
        setReport(data);
        writePageCache<Report>(cacheKey, data);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Report is not ready yet.");
      }
    }
    void loadReport();
  }, [documentId, language]);

  async function downloadReport() {
    try {
      setIsDownloading(true);
      const response = await authenticatedFetch(`${API_URL}/api/upload/${documentId}/report/download?language=${language}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail ?? "Could not download the report.");
      }
      const fileUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = fileUrl;
      link.download = `LegalLens-${report?.summary.filename ?? "report"}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(fileUrl);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Could not download the report.");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <DashboardLayout>
      <main className="mx-auto w-full max-w-6xl pb-8 text-[#181211]">
        <Link href={`/analysis/${documentId}?language=${language}`} className="inline-flex items-center gap-2 text-sm font-semibold text-[#0875D1] hover:underline"><ArrowLeft className="h-4 w-4" /> Back to analysis</Link>
        {error && <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>}
        {!report && !error && <div className="mt-8 rounded-2xl border border-black/10 bg-[#EAE6DB] p-8 text-sm text-[#67758A]">Loading report...</div>}
        {report && <>
          <header className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#0875D1]">Generated report</p><h1 className="mt-2 break-words text-3xl font-bold sm:text-4xl">{report.summary.filename}</h1><p className="mt-2 text-sm text-[#67758A]">Generated {new Date(report.summary.analyzed_at).toLocaleDateString()} · {report.summary.total_clauses} clauses analyzed</p></div><button type="button" onClick={() => void downloadReport()} disabled={isDownloading} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#181211] px-5 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60">{isDownloading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{isDownloading ? "Preparing PDF..." : "Download report"}</button></header>
          <section className="mt-6 rounded-2xl border border-black/10 bg-[#EAE6DB] p-5 sm:p-7"><div className="flex flex-col gap-5 sm:flex-row sm:items-center"><div className="relative flex h-32 w-32 shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(${overallRisk.color} ${score * 3.6}deg, #D6D3D1 0deg)` }} aria-label={`${score} out of 100 risk, ${overallRisk.label}`}><div className="flex h-[104px] w-[104px] items-center justify-center rounded-full bg-[#F7F3EA] text-center"><span className="text-3xl font-bold">{score}<small className="block text-xs font-normal text-[#67758A]">/100 risk</small></span></div></div><div><span className={`rounded-full border px-3 py-1 text-xs font-bold ${overallRisk.badgeClass}`}>{overallRisk.label}</span><h2 className="mt-4 text-2xl font-bold">Contract risk summary</h2><p className="mt-2 text-sm leading-6 text-[#526174]">This report consolidates the specialist agent findings into the key risks and recommended next steps.</p></div></div></section>
          <section className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">{[["High risk", report.summary.high_risk_count], ["Moderate", report.summary.medium_risk_count], ["Safe", report.summary.safe_count], ["Negotiable", report.summary.negotiable_count]].map(([label, count]) => <div key={String(label)} className="rounded-2xl border border-black/10 bg-[#EAE6DB] p-4"><p className="text-sm text-[#67758A]">{label} clauses</p><p className="mt-3 text-3xl font-bold">{count}</p></div>)}</section>
          <section className="mt-8 rounded-2xl border border-black/10 bg-[#EAE6DB] p-5 sm:p-7"><div className="flex items-center gap-3"><AlertTriangle className="h-6 w-6 text-[#0875D1]" /><h2 className="text-xl font-bold">Top risks</h2></div><div className="mt-5 space-y-3">{report.top_risks.map((risk) => <article key={risk.rank} className="rounded-xl border border-black/10 bg-[#F7F3EA] p-4"><div className="flex gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0875D1] text-sm font-bold text-white">{risk.rank}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{risk.title}</h3><span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${getClauseBadgeClass(risk.risk_level)}`}>{risk.risk_level === "high" ? "High risk" : risk.risk_level === "medium" ? "Moderate" : "Safe"}</span></div><p className="mt-1 text-xs text-[#67758A]">Page {risk.page}</p><p className="mt-3 text-sm leading-6 text-[#526174]">{risk.explanation}</p></div></div></article>)}</div></section>
          <section className="mt-8 rounded-2xl border border-black/10 bg-[#EAE6DB] p-5 sm:p-7"><div className="flex items-center gap-3"><Handshake className="h-6 w-6 text-[#0875D1]" /><h2 className="text-xl font-bold">Negotiation terms ({(report.negotiation_terms ?? []).length})</h2></div><p className="mt-2 text-sm text-[#67758A]">Every clause marked negotiable in this report is listed below.</p><div className="mt-5 space-y-3">{(report.negotiation_terms ?? []).length > 0 ? report.negotiation_terms?.map((term, index) => <article key={`${term.title}-${term.page}-${index}`} className="rounded-xl border border-black/10 bg-[#F7F3EA] p-4"><div className="flex gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0875D1] text-sm font-bold text-white">{index + 1}</span><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{term.title}</h3><span className="text-xs text-[#67758A]">Page {term.page}</span></div><p className="mt-2 text-sm leading-6 text-[#526174]">{term.suggestion}</p></div></div></article>) : <div className="rounded-xl border border-dashed border-black/15 bg-[#F7F3EA] p-4 text-sm text-[#67758A]">No clauses were marked negotiable for this document.</div>}</div></section>
          <section className="mt-8 rounded-2xl border border-black/10 bg-[#EAE6DB] p-5 sm:p-7"><div className="flex items-center gap-3"><FileText className="h-6 w-6 text-[#0875D1]" /><h2 className="text-xl font-bold">Plain {languageName} summary</h2></div><p className="mt-4 text-sm leading-7 text-[#526174]">{summaryLines.join(" ")}</p></section>
        </>}
      </main>
    </DashboardLayout>
  );
}
