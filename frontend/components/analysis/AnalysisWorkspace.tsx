"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ChevronDown, FileText, LoaderCircle, Minus, Plus, Sparkles } from "lucide-react";
import { Document as PdfDocument, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { API_URL, authenticatedFetch } from "@/lib/api";
import { readPageCache, writePageCache } from "@/lib/client-cache";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

type RiskLevel = "high" | "medium" | "safe";
type ClauseTab = "original" | "plain" | "risk" | "negotiation";
type Analysis = {
  summary: { filename: string; total_pages: number; total_clauses: number; overall_risk_score: number };
  contract_summary?: string[];
  clauses?: { id: string; clause_number: string; title: string; risk_level: RiskLevel; page: number; original_text: string; plain_english: string; risk_reason: string; negotiation_suggestion: string }[];
};

const riskStyles: Record<RiskLevel, string> = { high: "border-red-300 bg-red-50 text-red-700", medium: "border-amber-300 bg-amber-50 text-amber-800", safe: "border-green-300 bg-green-50 text-green-700" };

/** Page-aware clause review workspace shown after an analysis job completes. */
export default function AnalysisWorkspace() {
  const { documentId } = useParams<{ documentId: string }>();
  const searchParams = useSearchParams();
  const language = searchParams.get("language") ?? "en";
  const requestedClauseId = searchParams.get("clause");
  const languageName = { en: "English", hi: "Hindi", gu: "Gujarati", es: "Spanish", fr: "French" }[language] ?? "English";
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [renderedPages, setRenderedPages] = useState(1);
  const [selectedClauseId, setSelectedClauseId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ClauseTab>("plain");
  const [error, setError] = useState("");
  const [previewWidth, setPreviewWidth] = useState(0);
  const [zoomPercent, setZoomPercent] = useState(100);
  const pagePreviewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    const controller = new AbortController();
    const cacheKey = `analysis:${documentId}:${language}`;
    const cachedAnalysis = readPageCache<Analysis>(cacheKey, 5 * 60_000);
    if (cachedAnalysis) queueMicrotask(() => setAnalysis(cachedAnalysis));
    async function loadAnalysis() {
      try {
        const [analysisResponse, previewResponse] = await Promise.all([
          cachedAnalysis ? Promise.resolve(null) : authenticatedFetch(`${API_URL}/api/upload/${documentId}/analysis?language=${language}`, { signal: controller.signal }),
          authenticatedFetch(`${API_URL}/api/upload/${documentId}/preview`, { signal: controller.signal }),
        ]);
        if (analysisResponse) {
          const data = await analysisResponse.json();
          if (!analysisResponse.ok) throw new Error(data.detail ?? "Analysis is not ready yet.");
          setAnalysis(data);
          writePageCache<Analysis>(cacheKey, data);
        }
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
  }, [documentId, language]);

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
  // Keep the selected page zoomed enough to read, with scroll inside the preview.
  const fittedPageWidth = Math.min(560, Math.max(320, (previewWidth || 560) - 24));
  const pageWidth = Math.round(fittedPageWidth * (zoomPercent / 100));
  const allClauses = useMemo(() => (analysis?.clauses ?? []).map((clause) => ({
    ...clause,
    // AI page estimates can occasionally exceed the real page count. Never show
    // an impossible page number or try to render a page that does not exist.
    page: Math.min(totalPages, Math.max(1, Number(clause.page) || 1)),
  })), [analysis, totalPages]);
  const selectedClause = allClauses.find((clause) => clause.id === selectedClauseId) ?? null;

  // A global clause-search result can open the exact clause directly instead of
  // making the user find it again in the extracted-clause list.
  useEffect(() => {
    if (!requestedClauseId || !allClauses.some((clause) => clause.id === requestedClauseId)) return;
    const timer = window.setTimeout(() => {
      setSelectedClauseId(requestedClauseId);
      setActiveTab("plain");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [requestedClauseId, allClauses]);

  function highlightAcrossPages() {
    window.setTimeout(() => {
      const root = pagePreviewRef.current;
      const source = selectedClause?.original_text;
      if (!root || !source || !selectedClause) return;

      const normalize = (value: string) => value
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2013\u2014]/g, "-")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
      const clauseText = normalize(source);
      const colors: Record<RiskLevel, { fill: string; outline: string }> = {
        high: { fill: "rgba(254, 202, 202, 0.56)", outline: "rgba(239, 68, 68, 0.30)" },
        medium: { fill: "rgba(253, 224, 71, 0.50)", outline: "rgba(202, 138, 4, 0.55)" },
        safe: { fill: "rgba(187, 247, 208, 0.56)", outline: "rgba(22, 163, 74, 0.30)" },
      };
      const color = colors[selectedClause.risk_level];

      root.querySelectorAll<HTMLSpanElement>(".react-pdf__Page__textContent span").forEach((span) => {
        span.removeAttribute("data-clause-highlight");
        span.style.removeProperty("background-color");
        span.style.removeProperty("border-radius");
        span.style.removeProperty("box-shadow");
      });

      for (const pageRoot of root.querySelectorAll<HTMLElement>("[data-preview-page]")) {
        let cursor = 0;
        const segments = [...pageRoot.querySelectorAll<HTMLSpanElement>(".react-pdf__Page__textContent span")].map((span) => {
          const text = normalize(span.textContent ?? "");
          if (!text) return null;
          const start = cursor;
          cursor += text.length + 1;
          return { span, text, start, end: start + text.length };
        }).filter((segment): segment is { span: HTMLSpanElement; text: string; start: number; end: number } => segment !== null);
        const pageText = segments.map((segment) => segment.text).join(" ");
        let start = pageText.indexOf(clauseText);
        let length = clauseText.length;

        if (start < 0) {
          const words = clauseText.split(" ").filter((word) => word.length > 2);
          for (const phraseLength of [10, 8, 6, 5, 4, 3]) {
            if (start >= 0 || words.length < phraseLength) continue;
            for (let wordIndex = 0; wordIndex <= words.length - phraseLength; wordIndex += 1) {
              const phrase = words.slice(wordIndex, wordIndex + phraseLength).join(" ");
              const position = pageText.indexOf(phrase);
              if (position >= 0) {
                start = position;
                length = Math.max(phrase.length, clauseText.length - words.slice(0, wordIndex).join(" ").length);
                break;
              }
            }
          }
        }
        if (start < 0) {
          // Some analyses store a lightly paraphrased source. In that case, find the
          // best matching PDF text span by its meaningful words, then visibly mark it
          // instead of silently showing no highlight.
          const keywords = clauseText.split(" ").filter((word) => word.length > 3);
          let bestSegment: typeof segments[number] | null = null;
          let bestScore = 0;
          for (const segment of segments) {
            const score = keywords.reduce((total, word) => total + (segment.text.includes(word) ? 1 : 0), 0);
            if (score > bestScore) {
              bestSegment = segment;
              bestScore = score;
            }
          }
          if (bestSegment && bestScore >= 2) {
            bestSegment.span.setAttribute("data-clause-highlight", "true");
            bestSegment.span.style.backgroundColor = color.fill;
            bestSegment.span.style.borderRadius = "1px";
            bestSegment.span.style.boxShadow = `0 0 0 1px ${color.outline}`;
            pageRoot.scrollIntoView({ behavior: "smooth", block: "center" });
            return;
          }
          continue;
        }

        const end = Math.min(pageText.length, start + length);
        segments.forEach((segment) => {
          if (segment.end <= start || segment.start >= end) return;
          segment.span.setAttribute("data-clause-highlight", "true");
          segment.span.style.backgroundColor = color.fill;
          segment.span.style.borderRadius = "1px";
          segment.span.style.boxShadow = `0 0 0 1px ${color.outline}`;
        });
        pageRoot.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }, 0);
  }

  function selectClause(clause: NonNullable<Analysis["clauses"]>[number]) {
    setSelectedClauseId(clause.id);
    setActiveTab("plain");
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

          <section className="mt-6 rounded-2xl border border-[#0875D1]/20 bg-[#EAF4FE] p-5 text-[#10243E] sm:p-6">
            <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-[#0875D1]" /><h2 className="text-lg font-bold">{languageName} contract summary</h2></div>
            <p className="mt-3 text-sm leading-7 text-[#35465D]">{analysis.contract_summary?.length ? analysis.contract_summary.join(" ") : "The contract summary is being prepared from the selected language analysis."}</p>
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(330px,.9fr)]">
            <div className="flex h-[430px] min-w-0 flex-col overflow-hidden rounded-2xl border border-black/10 bg-[#EAE6DB] sm:h-[520px]">
              <div className="flex items-center justify-between gap-2 border-b border-black/10 px-4 py-3 text-sm text-[#526174]"><span className="min-w-0 truncate">Full document preview · {totalPages} pages</span><div className="flex shrink-0 items-center gap-1"><button type="button" onClick={() => setZoomPercent((current) => Math.max(60, current - 10))} disabled={zoomPercent <= 60} aria-label="Zoom out document" title="Zoom out" className="grid h-8 w-8 place-items-center rounded-lg border border-black/15 bg-[#F7F3EA] text-[#181211] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"><Minus className="h-4 w-4" /></button><span className="w-11 text-center text-xs font-semibold text-[#181211]" aria-live="polite">{zoomPercent}%</span><button type="button" onClick={() => setZoomPercent((current) => Math.min(180, current + 10))} disabled={zoomPercent >= 180} aria-label="Zoom in document" title="Zoom in" className="grid h-8 w-8 place-items-center rounded-lg border border-black/15 bg-[#F7F3EA] text-[#181211] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"><Plus className="h-4 w-4" /></button></div></div>
              <div ref={pagePreviewRef} className="min-h-0 flex-1 overflow-auto overscroll-contain bg-[#D5D5D5] p-3 sm:p-5">
                {previewUrl ? <PdfDocument file={previewUrl} loading={<LoaderCircle className="mx-auto mt-20 animate-spin text-[#0875D1]" />} onLoadSuccess={({ numPages }) => setRenderedPages(numPages)} error={<p className="mt-20 text-center text-sm text-red-700">Could not render the PDF preview.</p>}><div className="flex min-w-max flex-col items-center gap-6">{Array.from({ length: totalPages }, (_, index) => { const pageNumber = index + 1; return <div key={`${pageNumber}-${selectedClause?.id ?? "none"}`} data-preview-page={pageNumber} className="shadow-md"><Page pageNumber={pageNumber} width={pageWidth} renderAnnotationLayer={false} renderTextLayer onRenderTextLayerSuccess={highlightAcrossPages} /></div>; })}</div></PdfDocument> : <div className="mt-20 text-center text-sm text-[#67758A]">Loading PDF...</div>}
              </div>
            </div>

            <aside className="flex h-[430px] min-w-0 flex-col overflow-hidden rounded-2xl border border-black/15 bg-[#EAE6DB] sm:h-[520px]">
              <div className="flex items-center justify-between border-b border-black/15 px-5 py-6">
                <h2 className="text-lg font-bold">Extracted clauses</h2>
                <span className="text-sm text-[#526174]">{allClauses.length} shown</span>
              </div>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4">
                {allClauses.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-black/15 bg-[#F7F3EA] p-6 text-center text-sm text-[#67758A]">No extracted clauses are available for this document.</div>
                ) : allClauses.map((clause) => {
                  const isExpanded = selectedClause?.id === clause.id;
                  return (
                    <article key={clause.id} className="overflow-hidden rounded-2xl border border-black/15 bg-[#F7F3EA]">
                      <button type="button" onClick={() => selectClause(clause)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
                        <span className="rounded-xl border border-black/15 bg-[#EAE6DB] px-2 py-1.5 font-mono text-xs font-bold text-[#0875D1]">{clause.clause_number}</span>
                        <span className="min-w-0 flex-1"><span className="block break-words font-bold">{clause.title}</span><span className="mt-0.5 block text-sm text-[#526174]">Page {clause.page}</span></span>
                        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${riskStyles[clause.risk_level]}`}>• {clause.risk_level === "medium" ? "Moderate" : clause.risk_level === "high" ? "High Risk" : "Safe"}</span>
                        <ChevronDown className={`h-4 w-4 shrink-0 text-[#526174] transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      </button>
                      {isExpanded && <div className="border-t border-black/10 px-4 pb-4 pt-3">
                        <div className="grid grid-cols-4 rounded-xl bg-[#DDD8CF] p-1 text-center text-xs font-semibold">
                          {(["original", "plain", "risk", "negotiation"] as ClauseTab[]).map((tab) => <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`analysis-tab rounded-lg px-1 py-2 ${activeTab === tab ? "analysis-tab-active bg-[#F7F3EA] text-[#181211] shadow-sm" : "text-[#526174] hover:bg-[#F7F3EA] hover:text-[#181211]"}`}>{tab === "original" ? "Original" : tab === "plain" ? `Plain ${languageName}` : tab === "risk" ? "Risk" : "Negotiate"}</button>)}
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
