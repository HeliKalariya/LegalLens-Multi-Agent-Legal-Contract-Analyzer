"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BarChart3, FileText, ListChecks, ShieldCheck, TrendingDown, TrendingUp, Upload } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { API_URL, authenticatedFetch } from "@/lib/api";
import { readPageCache, writePageCache } from "@/lib/client-cache";

type DocumentItem = {
  document_id: string;
  original_filename: string;
  uploaded_at: string;
  analysis_status: string;
  clause_count?: number;
  risk_level?: "high" | "medium" | "safe" | "pending";
  risk_score?: number | null;
};

type DashboardData = {
  overview: {
    total_documents: number;
    analyzed_documents: number;
    total_clauses: number;
    reports_generated: number;
    average_risk_score: number;
  };
  risk_distribution: { safe: number; moderate: number; high: number };
  history: { month: string; reports_generated: number; average_risk_score: number }[];
};

type DashboardCache = { dashboard: DashboardData; documents: DocumentItem[] };

const riskStyles = {
  high: "border-red-300 bg-red-50 text-red-700",
  medium: "border-yellow-300 bg-yellow-50 text-yellow-800",
  safe: "border-green-300 bg-green-50 text-green-700",
};

/** Personal document-library overview fed by dashboard and documents APIs. */
export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const cached = readPageCache<DashboardCache>("dashboard");
    if (cached) {
      queueMicrotask(() => {
        if (controller.signal.aborted) return;
        setDashboard(cached.dashboard);
        setDocuments(cached.documents);
        setIsLoading(false);
      });
    }

    async function loadDashboard() {
      try {
        if (!cached) setLoadError("");
        // The dashboard data and document list are intentionally fetched separately:
        // cards/charts come from dashboard, while the table is the user's documents.
        const [dashboardResponse, documentsResponse] = await Promise.all([
          authenticatedFetch(`${API_URL}/api/dashboard/`, { signal: controller.signal }),
          // The table renders five rows; request only those rows from the server.
          authenticatedFetch(`${API_URL}/api/upload/?limit=5`, { signal: controller.signal }),
        ]);
        if (!dashboardResponse.ok) throw new Error("Could not load dashboard data.");
        if (!documentsResponse.ok) throw new Error("Could not load recent documents.");

        const fetchedDashboard = await dashboardResponse.json() as DashboardData;
        const payload = await documentsResponse.json();
        const fetchedDocuments = Array.isArray(payload.data) ? payload.data : [];
        // Keep the dashboard compact by retaining only the latest five items.
        setDashboard(fetchedDashboard);
        setDocuments(fetchedDocuments);
        writePageCache<DashboardCache>("dashboard", { dashboard: fetchedDashboard, documents: fetchedDocuments });
      } catch (error) {
      // React cancels the request during development remounts. That is expected
      // and should not be reported as an unhandled dashboard error. A short
      // FastAPI reload should show a recoverable message instead of an overlay.
      if (!controller.signal.aborted && !(error instanceof DOMException && error.name === "AbortError")) {
        setLoadError("The server is restarting or unavailable. Please refresh in a moment.");
      }
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
    }
    void loadDashboard();
    return () => controller.abort();
  }, []);

  const overview = dashboard?.overview;
  const distribution = dashboard?.risk_distribution ?? { safe: 0, moderate: 0, high: 0 };
  const safePercent = Math.round(distribution.safe);
  const mediumPercent = Math.round(distribution.moderate);
  // A new account has no analyzed clauses, so all three risk values must be zero.
  // Do not derive high risk from the remaining percentage; that incorrectly showed 100%.
  const highPercent = Math.max(0, Math.round(distribution.high));
  const history = dashboard?.history ?? [];
  const today = new Date();
  const currentYear = today.getFullYear();
  const monthlyReports = Array.from({ length: today.getMonth() + 1 }, (_, monthIndex) => {
    const month = `${currentYear}-${String(monthIndex + 1).padStart(2, "0")}`;
    const savedMonth = history.find((item) => item.month === month);
    return { month, reports_generated: savedMonth?.reports_generated ?? 0 };
  });
  const chartData = monthlyReports.map((item) => ({
    ...item,
    label: new Date(`${item.month}-01T00:00:00`).toLocaleString(undefined, { month: "short" }),
  }));

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-7xl text-[#181211]">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Dashboard</h1><p className="mt-2 text-sm text-[#67758A] sm:text-base">Welcome back. Here&apos;s what&apos;s happening in your contract library.</p></div>
          <Link href="/upload" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#181211] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-black"><Upload className="h-4 w-4" /> Upload contract</Link>
        </header>
        {loadError && <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">{loadError}</p>}

        <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Documents uploaded" value={overview?.total_documents ?? 0} icon={FileText} trend="Your legal document library" positive />
          <StatCard label="Average risk score" value={overview ? `${Math.round(overview.average_risk_score)} / 100` : "—"} icon={ShieldCheck} trend={overview?.analyzed_documents ? "Across analyzed documents" : "Analyze a document to begin"} />
          <StatCard label="Clauses detected" value={(overview?.total_clauses ?? 0).toLocaleString()} icon={ListChecks} trend="Extracted by AI specialists" positive />
          <StatCard label="Reports generated" value={overview?.reports_generated ?? 0} icon={BarChart3} trend="Completed document analyses" positive />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.8fr)_minmax(310px,.85fr)]">
          <article className="rounded-2xl border border-black/15 bg-[#EAE6DB] p-5 sm:p-6"><h2 className="text-lg font-bold">Document analysis history</h2><p className="mt-1 text-sm text-[#67758A]">Reports generated and average risk score over time.</p><div className="mt-6 h-64 rounded-xl bg-[#F7F3EA] p-3 sm:h-72 sm:p-4">{isLoading ? <div className="flex h-full items-center justify-center text-sm text-[#67758A]">Loading dashboard data…</div> : <ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 12, right: 12, left: -18, bottom: 0 }}><defs><linearGradient id="reportHistoryFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#0875D1" stopOpacity={0.25} /><stop offset="100%" stopColor="#0875D1" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#D6D3D1" strokeDasharray="3 3" /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#67758A", fontSize: 12 }} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#67758A", fontSize: 12 }} /><Tooltip cursor={{ stroke: "#0875D1", strokeWidth: 1 }} contentStyle={{ borderRadius: 12, borderColor: "#D6D3D1", background: "#F7F3EA" }} formatter={(value) => [`${value ?? 0} reports`, "Reports generated"]} /><Area type="monotone" dataKey="reports_generated" name="Reports generated" stroke="#0875D1" strokeWidth={3} fill="url(#reportHistoryFill)" dot={{ r: 4, fill: "#0875D1", strokeWidth: 0 }} activeDot={{ r: 6 }} /></AreaChart></ResponsiveContainer>}</div></article>
          <article className="rounded-2xl border border-black/15 bg-[#EAE6DB] p-5 sm:p-6"><h2 className="text-lg font-bold">Risk distribution</h2><p className="mt-1 text-sm text-[#67758A]">Across all analyzed clauses.</p><div className="mx-auto mt-6 grid h-44 w-44 place-items-center rounded-full" style={{ background: `conic-gradient(#36A269 0 ${safePercent}%, #F2B134 ${safePercent}% ${safePercent + mediumPercent}%, #DA3B36 ${safePercent + mediumPercent}% 100%)` }}><div className="grid h-28 w-28 place-items-center rounded-full bg-[#EAE6DB] text-center"><span className="text-2xl font-bold">{overview?.total_clauses ?? 0}</span><span className="text-xs text-[#67758A]">clauses</span></div></div><div className="mt-6 space-y-3 text-sm"><RiskRow label="Safe" color="bg-[#36A269]" value={safePercent} /><RiskRow label="Moderate" color="bg-[#F2B134]" value={mediumPercent} /><RiskRow label="High risk" color="bg-[#DA3B36]" value={highPercent} /></div></article>
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-black/15 bg-[#EAE6DB]"><div className="flex items-center justify-between border-b border-black/10 px-5 py-5 sm:px-6"><h2 className="text-lg font-bold">Recent documents</h2><Link href="/documents" className="text-sm font-semibold text-[#0875D1] hover:underline">View all</Link></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-black/10 text-xs uppercase tracking-wide text-[#526174]"><tr><th className="px-6 py-4 font-medium">File name</th><th className="px-4 py-4 font-medium">Upload date</th><th className="px-4 py-4 font-medium">Status</th><th className="px-4 py-4 font-medium">Risk score</th><th className="px-6 py-4 text-right font-medium">Report</th></tr></thead><tbody>{isLoading ? <tr><td colSpan={5} className="px-6 py-10 text-center text-[#67758A]">Loading documents…</td></tr> : documents.slice(0, 5).map((document) => <tr key={document.document_id} className="border-b border-black/10 last:border-0"><td className="px-6 py-4"><div className="flex max-w-[300px] items-center gap-3"><span className="rounded-xl border border-black/10 bg-[#F7F3EA] p-2 text-[#0875D1]"><FileText className="h-5 w-5" /></span><span className="truncate font-semibold" title={document.original_filename}>{document.original_filename}</span></div></td><td className="px-4 py-4 text-[#526174]">{new Date(document.uploaded_at).toLocaleDateString()}</td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${document.analysis_status === "analyzed" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"}`}>{document.analysis_status === "analyzed" ? "• Analyzed" : "• Processing"}</span></td><td className="px-4 py-4">{document.risk_level && document.risk_level !== "pending" && typeof document.risk_score === "number" ? <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${riskStyles[document.risk_level]}`}>• {document.risk_level === "high" ? "High risk" : document.risk_level === "medium" ? "Moderate" : "Safe"} <span className="ml-1 font-bold text-current">{document.risk_score}/100</span></span> : <span className="text-[#67758A]">—</span>}</td><td className="px-6 py-4 text-right">{document.analysis_status === "analyzed" ? <Link href={`/reports/${document.document_id}`} className="font-semibold text-[#181211] hover:text-[#0875D1]">View ↗</Link> : <span className="text-[#67758A]">—</span>}</td></tr>)}{!isLoading && documents.length === 0 && <tr><td colSpan={5} className="px-6 py-10 text-center text-[#67758A]">No documents uploaded yet.</td></tr>}</tbody></table></div></section>
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
