"use client";

import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PdfViewer from "@/components/upload/PdfViewer";
import UploadDropzone from "@/components/upload/UploadDropzone";
import RecentUploads from "@/components/upload/RecentUploads";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

type Analysis = {
  document_type: string;
  legal_signals: string[];
  risk_topics: string[];
  message: string;
};

export default function UploadPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [uploadedDocumentId, setUploadedDocumentId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analysisError, setAnalysisError] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  async function analyzeDocument() {
    if (!uploadedDocumentId) return;
    setIsAnalyzing(true);
    setAnalysis(null);
    setAnalysisError("");
    try {
      const response = await fetch(`${API_URL}/api/upload/${uploadedDocumentId}/analyze`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail ?? "Analysis failed.");
      setAnalysis(result);
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "Analysis failed.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl">
        {/* Heading */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">
            Upload document
          </h1>

          <p className="mt-2 text-gray-600">
            Save a PDF contract locally, then open it again from the list below.
          </p>
        </div>

        <UploadDropzone onUploaded={(documentId) => {
          setUploadedDocumentId(documentId);
          setAnalysis(null);
          setAnalysisError("");
          setRefreshKey((key) => key + 1);
        }} />

        {uploadedDocumentId && (
          <section className="mb-8 rounded-3xl border bg-white p-6 shadow-sm">
            <button type="button" onClick={() => void analyzeDocument()} disabled={isAnalyzing} className="rounded-xl bg-black px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-400">
              {isAnalyzing ? "Analyzing…" : "Analyze document"}
            </button>
            {analysisError && <p className="mt-4 text-sm text-red-600">{analysisError}</p>}
            {analysis && (
              <div className="mt-4 text-sm text-gray-700">
                <p className="font-semibold">{analysis.message}</p>
                <p className="mt-1">Type: {analysis.document_type}</p>
                <p className="mt-1">Legal signals: {analysis.legal_signals.join(", ")}</p>
                <p className="mt-1">Risk topics: {analysis.risk_topics.length ? analysis.risk_topics.join(", ") : "None found"}</p>
              </div>
            )}
          </section>
        )}

        <RecentUploads refreshKey={refreshKey} onOpenPdf={setSelectedDocumentId} />
      </div>
      <PdfViewer documentId={selectedDocumentId} onClose={() => setSelectedDocumentId(null)} />
    </DashboardLayout>
  );
}
