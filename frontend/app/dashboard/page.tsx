"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, FileText, ListChecks, ShieldCheck, TrendingDown, TrendingUp, Upload } from "lucide-react";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { API_URL, authenticatedFetch } from "@/lib/api";

type DocumentItem = {
  document_id: string;
  uploaded_at: string;
  analysis_status: string;
  clause_count?: number;
};

type Analysis = {
  summary?: { overall_risk_score?: number };
  clauses?: { risk_level: "high" | "medium" | "safe" }[];
};

const emptyDistribution = { high: 0, medium: 0, safe: 0 };

/** Personal document-library overview, populated from the signed-in user's stored analyses. */
export default function DashboardPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    async function loadDashboard() {
      try {
        const response = await authenticatedFetch(`${API_URL}/api/upload/`, { signal: controller.signal });
        const result = await response.json();
        if (!response.ok) return;
        const savedDocuments: DocumentItem[] = Array.isArray(result.data) ? result.data : [];
        setDocuments(savedDocuments);
        const completed = savedDocuments.filter((document) => document.analysis_status === "analyzed");
        const completedAnalyses = await Promise.all(completed.map(async (document) => {
          const analysisResponse = await authenticatedFetch(`${API_URL}/api/upload/${document.document_id}/analysis`, { signal: controller.signal });
          return analysisResponse.ok ? analysisResponse.json() as Promise<Analysis> : null;
        }));
        setAnalyses(completedAnalyses.filter((analysis): analysis is Analysis => analysis !== null));
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }
    void loadDashboard();
    return () => controller.abort();
  }, []);

  const stats = useMemo(() => {
    const scores = analyses.map((analysis) => analysis.summary?.overall_risk_score).filter((score): score is number => typeof score === "number");
    const distribution = analyses.flatMap((analysis) => analysis.clauses ?? []).reduce((total, clause) => {
      total[clause.risk_level] += 1;
      return total;
    }, { ...emptyDistribution });
    const clauseCount = Object.values(distribution).reduce((total, count) => total + count, 0) || documents.reduce((total, document) => total + (document.clause_count ?? 0), 0);
    return {
      averageRisk: scores.length ? Math.round(scores.reduce((total, score) => total + score, 0) / scores.length) : 0,
      analyzed: analyses.length,
      clauseCount,
      distribution,
    };
  }, [analyses, documents]);

  const history = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      return date;
    });
    return days.map((day) => documents.filter((document) => new Date(document.uploaded_at).toDateString() === day.toDateString()).length);
  }, [documents]);

  const chart = useMemo(() => {
    const maximum = Math.max(1, ...history);
    return history.map((count, index) => {
      const x = 8 + index * 15.5;
      const y = 88 - (count / maximum) * 62;
      return `${x},${y}`;
    }).join(" ");
  }, [history]);

  const totalClauses = Math.max(1, stats.clauseCount);
  const safePercent = Math.round((stats.distribution.safe / totalClauses) * 100);
  const mediumPercent = Math.round((stats.distribution.medium / totalClauses) * 100);
  const highPercent = Math.max(0, 100 - safePercent - mediumPercent);

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-7xl text-[#181211]">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Dashboard</h1>
            <p className="mt-2 text-sm text-[#67758A] sm:text-base">Welcome back. Here&apos;s what&apos;s happening in your contract library.</p>
          </div>
          <Link href="/upload" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#181211] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-black"><Upload className="h-4 w-4" /> Upload contract</Link>
        </header>

        <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Documents uploaded" value={documents.length} icon={FileText} trend="Your legal document library" positive />
          <StatCard label="Average risk score" value={stats.averageRisk ? `${stats.averageRisk} / 100` : "—"} icon={ShieldCheck} trend={stats.averageRisk ? "Across analyzed documents" : "Analyze a document to begin"} />
          <StatCard label="Clauses detected" value={stats.clauseCount.toLocaleString()} icon={ListChecks} trend="Extracted by AI specialists" positive />
          <StatCard label="Reports generated" value={stats.analyzed} icon={BarChart3} trend="Completed document analyses" positive />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.8fr)_minmax(310px,.85fr)]">
          <article className="rounded-2xl border border-black/15 bg-[#EAE6DB] p-5 sm:p-6">
            <h2 className="text-lg font-bold">Document analysis history</h2>
            <p className="mt-1 text-sm text-[#67758A]">Documents uploaded over the last seven days.</p>
            <div className="mt-6 h-64 rounded-xl bg-[#F7F3EA] p-4 sm:h-72">
              {isLoading ? <div className="flex h-full items-center justify-center text-sm text-[#67758A]">Loading dashboard data…</div> : (
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full" aria-label="Document upload history chart" role="img">
                  {[25, 50, 75].map((y) => <line key={y} x1="8" x2="100" y1={y} y2={y} stroke="currentColor" className="text-black/10" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />)}
                  <polyline points={chart} fill="none" stroke="#0875D1" strokeWidth="1.25" vectorEffect="non-scaling-stroke" />
                  <polygon points={`8,88 ${chart} 101,88`} fill="#0875D1" opacity="0.12" />
                </svg>
              )}
            </div>
          </article>

          <article className="rounded-2xl border border-black/15 bg-[#EAE6DB] p-5 sm:p-6">
            <h2 className="text-lg font-bold">Risk distribution</h2>
            <p className="mt-1 text-sm text-[#67758A]">Across all analyzed clauses.</p>
            <div className="mx-auto mt-6 grid h-44 w-44 place-items-center rounded-full" style={{ background: `conic-gradient(#36A269 0 ${safePercent}%, #F2B134 ${safePercent}% ${safePercent + mediumPercent}%, #DA3B36 ${safePercent + mediumPercent}% 100%)` }}>
              <div className="grid h-28 w-28 place-items-center rounded-full bg-[#EAE6DB] text-center"><span className="text-2xl font-bold">{stats.clauseCount}</span><span className="text-xs text-[#67758A]">clauses</span></div>
            </div>
            <div className="mt-6 space-y-3 text-sm">
              <RiskRow label="Safe" color="bg-[#36A269]" value={safePercent} />
              <RiskRow label="Moderate" color="bg-[#F2B134]" value={mediumPercent} />
              <RiskRow label="High risk" color="bg-[#DA3B36]" value={highPercent} />
            </div>
          </article>
        </section>
      </div>
    </DashboardLayout>
  );
}

function StatCard({ label, value, icon: Icon, trend, positive = false }: { label: string; value: string | number; icon: typeof FileText; trend: string; positive?: boolean }) {
  return <article className="rounded-2xl border border-black/15 bg-[#EAE6DB] p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><p className="text-sm text-[#526174]">{label}</p><Icon className="h-5 w-5 text-[#67758A]" /></div><p className="mt-5 text-3xl font-bold">{value}</p><p className={`mt-2 flex items-center gap-1 text-sm ${positive ? "text-emerald-700" : "text-[#67758A]"}`}>{positive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}{trend}</p></article>;
}

function RiskRow({ label, color, value }: { label: string; color: string; value: number }) {
  return <div className="flex items-center justify-between"><span className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${color}`} />{label}</span><span className="font-semibold">{value}%</span></div>;
}
