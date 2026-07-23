"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, FileText, ShieldCheck, Sparkles } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { API_URL } from "@/lib/api";

type Report = {
  filename: string;
  page_count: number;
  overall_risk: "High" | "Medium" | "Low";
  summary: string;
  clauses: { title: string; excerpt: string }[];
  risks: { title: string; severity: "High" | "Medium" | "Low"; detail: string }[];
  negotiation_suggestions: string[];
  agent_results: { name: string; status: string; detail: string }[];
};

const riskClasses = {
  High: "bg-red-50 text-red-700 ring-red-200",
  Medium: "bg-amber-50 text-amber-700 ring-amber-200",
  Low: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

export default function AnalysisPage() {
  const { documentId } = useParams<{ documentId: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadReport() {
      try {
        const response = await fetch(`${API_URL}/api/upload/${documentId}/analysis`);
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail ?? "Could not load this report.");
        setReport(result);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Could not load this report.");
      }
    }
    void loadReport();
  }, [documentId]);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl">
        <Link href="/upload" className="text-sm font-medium text-blue-600 hover:underline">← Upload another document</Link>
        {error && <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">{error}</div>}
        {!error && !report && <div className="mt-6 rounded-2xl border bg-white p-8 text-gray-600">Generating detailed report…</div>}
        {report && <>
          <header className="mt-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-blue-600">MULTI-AGENT ANALYSIS REPORT</p>
              <h1 className="mt-1 text-3xl font-bold text-gray-950">{report.filename}</h1>
              <p className="mt-2 text-gray-600">{report.page_count} page(s) analyzed by four specialized agents.</p>
            </div>
            <span className={`rounded-full px-4 py-2 text-sm font-bold ring-1 ${riskClasses[report.overall_risk]}`}>{report.overall_risk} overall risk</span>
          </header>

          <section className="mt-7 rounded-3xl border bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3"><ShieldCheck className="text-blue-600" /><h2 className="text-xl font-semibold">Executive summary</h2></div>
            <p className="mt-4 text-gray-700">{report.summary}</p>
          </section>

          <section className="mt-6 rounded-3xl border bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3"><Sparkles className="text-blue-600" /><h2 className="text-xl font-semibold">Agent activity</h2></div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {report.agent_results.map((agent) => <div key={agent.name} className="rounded-2xl bg-gray-50 p-4"><div className="flex items-center gap-2 font-semibold"><CheckCircle2 size={18} className="text-emerald-600" />{agent.name}</div><p className="mt-2 text-sm text-gray-600">{agent.detail}</p></div>)}
            </div>
          </section>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section className="rounded-3xl border bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><AlertTriangle className="text-amber-500" /><h2 className="text-xl font-semibold">Risk findings</h2></div>
              <div className="mt-5 space-y-4">{report.risks.length ? report.risks.map((risk) => <article key={risk.title} className="border-b pb-4 last:border-0 last:pb-0"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{risk.title}</h3><span className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${riskClasses[risk.severity]}`}>{risk.severity}</span></div><p className="mt-2 text-sm leading-6 text-gray-600">{risk.detail}</p></article>) : <p className="text-sm text-gray-600">No predefined risk provisions were detected. Review the complete contract before signing.</p>}</div>
            </section>
            <section className="rounded-3xl border bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><FileText className="text-blue-600" /><h2 className="text-xl font-semibold">Negotiation recommendations</h2></div>
              <ul className="mt-5 space-y-3">{report.negotiation_suggestions.length ? report.negotiation_suggestions.map((suggestion) => <li key={suggestion} className="rounded-xl bg-blue-50 p-4 text-sm leading-6 text-blue-950">{suggestion}</li>) : <li className="text-sm text-gray-600">No targeted negotiation recommendation was generated.</li>}</ul>
            </section>
          </div>

          <section className="mt-6 rounded-3xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-semibold">Extracted clauses</h2><div className="mt-5 space-y-4">{report.clauses.length ? report.clauses.map((clause) => <article key={clause.title} className="rounded-2xl bg-gray-50 p-4"><h3 className="font-semibold">{clause.title}</h3><p className="mt-2 text-sm leading-6 text-gray-600">{clause.excerpt}</p></article>) : <p className="text-sm text-gray-600">No matching clauses were extracted.</p>}</div></section>
        </>}
      </div>
    </DashboardLayout>
  );
}
