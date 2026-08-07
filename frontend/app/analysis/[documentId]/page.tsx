"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight, FileText, LoaderCircle } from "lucide-react";
import { Document as PdfDocument, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { API_URL, authenticatedFetch } from "@/lib/api";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

type RiskLevel = "high" | "medium" | "safe";
type ClauseTab = "original" | "plain" | "risk" | "negotiation";
type Analysis = {
  summary: { filename: string; total_pages: number; total_clauses: number; overall_risk_score: number };
  clauses?: { id: string; clause_number: string; title: string; risk_level: RiskLevel; page: number; original_text: string; plain_english: string; risk_reason: string; negotiation_suggestion: string }[];
};

const riskStyles: Record<RiskLevel, string> = { high: "border-red-300 bg-red-50 text-red-700", medium: "border-amber-300 bg-amber-50 text-amber-800", safe: "border-green-300 bg-green-50 text-green-700" };

/** Page-aware clause review workspace shown after an analysis job completes. */
export default function AnalysisWorkspacePage() {
  const { documentId } = useParams<{ documentId: string }>();
  const language = useSearchParams().get("language") ?? "en";
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [renderedPages, setRenderedPages] = useState(1);
  const [selectedClauseId, setSelectedClauseId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ClauseTab>("plain");
  const [error, setError] = useState("");
  const [previewWidth, setPreviewWidth] = useState(0);
  const pagePreviewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    const controller = new AbortController();
    async function loadAnalysis() {
      try {
        const [analysisResponse, previewResponse] = await Promise.all([
          authenticatedFetch(`${API_URL}/api/upload/${documentId}/analysis`, { signal: controller.signal }),
          authenticatedFetch(`${API_URL}/api/upload/${documentId}/preview`, { signal: controller.signal }),
        ]);
        const data = await analysisResponse.json();
        if (!analysisResponse.ok) throw new Error(data.detail ?? "Analysis is not ready yet.");
        setAnalysis(data);
        if (previewResponse.ok) {
          objectUrl = URL.createObjectURL(await previewResponse.blob());
          setPreviewUrl(objectUrl);
        }
      } catch (loadError) {
        if (loadError instanceof Error && loadError.name !== "AbortError") setError(loadError.message);
      }
    }
    void loadAnalysis();
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [documentId]);

  useEffect(() => {
    const preview = pagePreviewRef.current;
    if (!preview) return;
    const updatePreviewWidth = () => setPreviewWidth(Math.max(240, Math.floor(preview.clientWidth - 24)));
    updatePreviewWidth();
    const observer = new ResizeObserver(updatePreviewWidth);
    observer.observe(preview);
    return () => observer.disconnect();
  }, []);

  const totalPages = Math.max(analysis?.summary.total_pages ?? 1, renderedPages);
  // A compact page keeps the full preview visible without internal scrollbars.
  const pageWidth = Math.min(380, previewWidth || 380);
  const pageClauses = useMemo(() => (analysis?.clauses ?? []).filter((clause) => clause.page === currentPage), [analysis, currentPage]);
  const selectedClause = pageClauses.find((clause) => clause.id === selectedClauseId) ?? pageClauses[0] ?? null;

  function highlightSelectedClause() {
    window.setTimeout(() => {
      const root = pagePreviewRef.current;
      if (!root) return;
      const spans = [...root.querySelectorAll<HTMLSpanElement>(".react-pdf__Page__textContent span")];
      spans.forEach((span) => {
        span.removeAttribute("data-clause-highlight");
        span.style.removeProperty("background-color");
        span.style.removeProperty("border-radius");
        span.style.removeProperty("box-shadow");
      });

      // PDF.js divides one sentence into many positioned text spans. Joining those
      // spans lets us match and highlight the complete saved clause, not just a word.
      const normalize = (value: string) => value
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2013\u2014]/g, "-")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
      const clauseText = normalize(selectedClause?.original_text ?? "");
      if (!clauseText) return;
      const highlightColors: Record<RiskLevel, { fill: string; outline: string }> = {
        high: { fill: "rgba(254, 202, 202, 0.56)", outline: "rgba(239, 68, 68, 0.30)" },
        medium: { fill: "rgba(253, 230, 138, 0.56)", outline: "rgba(217, 119, 6, 0.32)" },
        safe: { fill: "rgba(187, 247, 208, 0.56)", outline: "rgba(22, 163, 74, 0.30)" },
      };
      const highlightColor = highlightColors[selectedClause?.risk_level ?? "safe"];

      let cursor = 0;
      const segments = spans.map((span) => {
        const text = normalize(span.textContent ?? "");
        if (!text) return null;
        const start = cursor;
        cursor += text.length + 1;
        return { span, text, start, end: start + text.length };
      }).filter((segment): segment is { span: HTMLSpanElement; text: string; start: number; end: number } => segment !== null);
      const pageText = segments.map((segment) => segment.text).join(" ");
      let matchStart = pageText.indexOf(clauseText);
      const matchLength = clauseText.length;

      // If the PDF changes punctuation during text extraction, anchor to the first
      // words and still highlight the approximate full clause-length range.
      if (matchStart < 0) {
        const anchor = clauseText.split(" ").slice(0, 8).join(" ");
        matchStart = pageText.indexOf(anchor);
      }
      if (matchStart < 0) return;
      const matchEnd = matchStart + matchLength;

      segments.forEach(({ span, start, end }) => {
        if (end <= matchStart || start >= matchEnd) return;
        span.setAttribute("data-clause-highlight", "true");
        // Keep PDF.js text transparent so the original PDF lettering remains visible
        // through this light overlay.
        span.style.backgroundColor = highlightColor.fill;
        span.style.borderRadius = "1px";
        span.style.boxShadow = `0 0 0 1px ${highlightColor.outline}`;
      });
    }, 0);
  }

  const detailContent = !selectedClause ? "Choose a clause to view its analysis." : activeTab === "original" ? selectedClause.original_text : activeTab === "plain" ? selectedClause.plain_english || selectedClause.original_text : activeTab === "risk" ? selectedClause.risk_reason || "This clause was flagged by the risk specialist for review." : selectedClause.negotiation_suggestion || "Ask for clearer and more balanced language before signing.";

  return (
    <DashboardLayout>
      <main className="mx-auto w-full max-w-7xl text-[#181211]">
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        {!analysis && !error && <div className="rounded-xl border border-black/10 bg-[#EAE6DB] p-6 text-sm text-[#67758A]">Loading completed analysis...</div>}
        {analysis && <>
          <header className="flex flex-col gap-4 border-b border-black/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#0875D1]">Document analysis</p><h1 className="mt-2 truncate text-2xl font-bold sm:text-3xl" title={analysis.summary.filename}>{analysis.summary.filename}</h1><p className="mt-2 text-sm text-[#67758A]">{analysis.summary.total_clauses} clauses detected · Overall risk {analysis.summary.overall_risk_score}/100</p></div>
            <Link href={`/reports/${documentId}?language=${language}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#181211] px-5 py-3 text-sm font-semibold text-white"><FileText className="h-4 w-4" /> Generate report</Link>
          </header>

          <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(330px,.9fr)]">
            <div className="min-w-0 overflow-hidden rounded-2xl border border-black/10 bg-[#EAE6DB]">
              <div className="flex items-center justify-between border-b border-black/10 px-4 py-3 text-sm text-[#526174]"><span>Page {currentPage} of {totalPages}</span><span className="max-w-[45%] truncate">{analysis.summary.filename}</span></div>
              <div ref={pagePreviewRef} className="flex h-[460px] items-start justify-center overflow-hidden bg-[#D5D5D5] p-3 sm:h-[620px] sm:p-4">
                {previewUrl ? <PdfDocument file={previewUrl} loading={<LoaderCircle className="mt-20 animate-spin text-[#0875D1]" />} onLoadSuccess={({ numPages }) => setRenderedPages(numPages)} error={<p className="mt-20 text-sm text-red-700">Could not render the PDF preview.</p>}><Page key={`${currentPage}-${selectedClause?.id ?? "none"}`} pageNumber={currentPage} width={pageWidth} renderAnnotationLayer={false} renderTextLayer onRenderTextLayerSuccess={highlightSelectedClause} /></PdfDocument> : <div className="mt-20 text-sm text-[#67758A]">Loading PDF...</div>}
              </div>
              <div className="flex items-center justify-between border-t border-black/10 p-3"><button type="button" disabled={currentPage === 1} onClick={() => { setCurrentPage((value) => value - 1); setSelectedClauseId(null); setActiveTab("plain"); }} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-[#F7F3EA] disabled:opacity-40"><ChevronLeft className="h-4 w-4" /> Previous</button><button type="button" disabled={currentPage === totalPages} onClick={() => { setCurrentPage((value) => value + 1); setSelectedClauseId(null); setActiveTab("plain"); }} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-[#F7F3EA] disabled:opacity-40">Next <ChevronRight className="h-4 w-4" /></button></div>
            </div>

            <aside className="min-w-0 overflow-hidden rounded-2xl border border-black/15 bg-[#EAE6DB]">
              <div className="flex items-center justify-between border-b border-black/15 px-5 py-6">
                <h2 className="text-lg font-bold">Extracted clauses</h2>
                <span className="text-sm text-[#526174]">{pageClauses.length} shown</span>
              </div>
              <div className="space-y-3 p-4">
                {pageClauses.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-black/15 bg-[#F7F3EA] p-6 text-center text-sm text-[#67758A]">No extracted clauses are associated with page {currentPage}.</div>
                ) : pageClauses.map((clause) => {
                  const isExpanded = selectedClause?.id === clause.id;
                  return (
                    <article key={clause.id} className="overflow-hidden rounded-2xl border border-black/15 bg-[#F7F3EA]">
                      <button type="button" onClick={() => { setSelectedClauseId(clause.id); setActiveTab("plain"); }} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
                        <span className="rounded-xl border border-black/15 bg-[#EAE6DB] px-2 py-1.5 font-mono text-xs font-bold text-[#0875D1]">{clause.clause_number}</span>
                        <span className="min-w-0 flex-1"><span className="block break-words font-bold">{clause.title}</span><span className="mt-0.5 block text-sm text-[#526174]">Page {clause.page}</span></span>
                        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${riskStyles[clause.risk_level]}`}>• {clause.risk_level === "medium" ? "Moderate" : clause.risk_level === "high" ? "High Risk" : "Safe"}</span>
                        <ChevronDown className={`h-4 w-4 shrink-0 text-[#526174] transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      </button>
                      {isExpanded && <div className="border-t border-black/10 px-4 pb-4 pt-3">
                        <div className="grid grid-cols-4 rounded-xl bg-[#DDD8CF] p-1 text-center text-xs font-semibold">
                          {(["original", "plain", "risk", "negotiation"] as ClauseTab[]).map((tab) => <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`rounded-lg px-1 py-2 ${activeTab === tab ? "bg-[#F7F3EA] text-[#181211] shadow-sm" : "text-[#526174]"}`}>{tab === "original" ? "Original" : tab === "plain" ? "Plain English" : tab === "risk" ? "Risk" : "Negotiate"}</button>)}
                        </div>
                        <div className="mt-3 rounded-xl border border-black/15 bg-[#EAE6DB] p-4 text-sm leading-6 text-[#181211]">{detailContent}</div>
                      </div>}
                    </article>
                  );
                })}
              </div>
            </aside>
          </section>
        </>}
      </main>
    </DashboardLayout>
  );
}
