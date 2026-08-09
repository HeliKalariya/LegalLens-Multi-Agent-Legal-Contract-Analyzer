"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, FileSearch2, FileText, Search, SlidersHorizontal } from "lucide-react";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { API_URL, authenticatedFetch } from "@/lib/api";

type Document = {
  document_id: string;
  original_filename: string;
  uploaded_at: string;
  document_type?: string;
  clause_count?: number;
  risk_level?: "high" | "medium" | "safe" | "pending";
  analysis_status: string;
};

const riskStyles = {
  high: "border-red-300 bg-red-50 text-red-700",
  medium: "border-amber-300 bg-amber-50 text-amber-800",
  safe: "border-green-300 bg-green-50 text-green-700",
  pending: "border-gray-300 bg-gray-100 text-gray-600",
};

const riskLabels = {
  high: "High Risk",
  medium: "Moderate",
  safe: "Safe",
  pending: "Not analyzed",
};

/** Shows the signed-in user's locally stored documents from the database. */
export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [query, setQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadDocuments() {
      try {
        setIsLoading(true);
        const response = await authenticatedFetch(`${API_URL}/api/upload/`, { signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail ?? "Could not load documents.");
        setDocuments(Array.isArray(result.data) ? result.data : []);
      } catch (loadError) {
        if (loadError instanceof Error && loadError.name === "AbortError") return;
        setError(loadError instanceof Error ? loadError.message : "Could not load documents.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadDocuments();
    return () => controller.abort();
  }, []);

  const filteredDocuments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return documents.filter((document) => {
      const matchesQuery = !normalizedQuery || [document.original_filename, document.document_type]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(normalizedQuery));
      const matchesRisk = riskFilter === "all" || document.risk_level === riskFilter;
      return matchesQuery && matchesRisk;
    });
  }, [documents, query, riskFilter]);

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[#181211] sm:text-4xl">Documents</h1>
            <p className="mt-2 text-sm text-[#67758A] sm:text-base">All legal documents saved to your account.</p>
          </div>
          <Link
            href="/upload"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#181211] px-5 py-3 text-sm font-semibold text-white transition hover:bg-black sm:w-auto"
          >
            Upload new
          </Link>
        </div>

       

        {isLoading && <p className="py-14 text-center text-sm text-[#67758A]">Loading documents...</p>}
        {!isLoading && error && <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}

        {!isLoading && !error && filteredDocuments.length === 0 && (
          <div className="rounded-2xl border border-dashed border-black/20 bg-[#EAE6DB] px-6 py-16 text-center">
            <FileText className="mx-auto h-10 w-10 text-[#0875D1]" />
            <h2 className="mt-4 text-lg font-semibold text-[#181211]">No documents found</h2>
            <p className="mt-2 text-sm text-[#67758A]">Upload a legal PDF to see it here.</p>
          </div>
        )}

        {!isLoading && !error && filteredDocuments.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredDocuments.map((document) => {
              const riskLevel = document.risk_level ?? "pending";
              return (
                <article key={document.document_id} className="flex min-w-0 flex-col rounded-2xl border border-black/15 bg-[#EAE6DB] p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-black/15 bg-[#F7F3EA] text-[#0875D1]">
                      <FileText className="h-6 w-6" />
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${riskStyles[riskLevel]}`}>
                      <span className="mr-1.5">•</span>{riskLabels[riskLevel]}
                    </span>
                  </div>

                  <h2 className="mt-5 truncate text-lg font-semibold text-[#181211]" title={document.original_filename}>
                    {document.original_filename}
                  </h2>
                  <div className="mt-2 flex items-center justify-between gap-3 text-sm text-[#67758A]">
                    <span className="truncate">{document.document_type ?? "Legal document"}</span>
                    <span className="shrink-0">{document.clause_count ?? 0} clauses</span>
                  </div>
                  <p className="mt-3 text-sm text-[#67758A]">Uploaded {new Date(document.uploaded_at).toLocaleDateString()}</p>

                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <Link
                      href={`/analysis/${document.document_id}`}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#0875D1] bg-[#0875D1] px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#065FA8] hover:shadow-md"
                    >
                      <FileSearch2 className="h-4 w-4 text-white" /> Analysis
                    </Link>
                    {document.analysis_status === "analyzed" ? (
                      <Link
                        href={`/reports/${document.document_id}`}
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#181211] px-3 text-sm font-semibold text-white transition hover:bg-black"
                      >
                        <BarChart3 className="h-4 w-4" /> Report
                      </Link>
                    ) : (
                      <span className="inline-flex min-h-10 cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-black/20 px-3 text-sm font-semibold text-white" title="Complete analysis before opening the report">
                        <BarChart3 className="h-4 w-4" /> Report
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
