"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PdfViewer from "@/components/upload/PdfViewer";
import UploadDropzone from "@/components/upload/UploadDropzone";
import RecentUploads from "@/components/upload/RecentUploads";
import { API_URL } from "@/lib/api";

export default function UploadPage() {
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [uploadedDocumentId, setUploadedDocumentId] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  async function analyzeDocument() {
    if (!uploadedDocumentId) return;
    setIsAnalyzing(true);
    setAnalysisError("");
    try {
      const response = await fetch(`${API_URL}/api/upload/${uploadedDocumentId}/analyze`, {
        method: "POST",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail ?? "Analysis failed.");
      router.push(`/analysis/${uploadedDocumentId}`);
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "Analysis failed.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Upload document</h1>
          <p className="mt-2 text-gray-600">Upload a PDF contract to create a detailed legal analysis report.</p>
        </div>

        <UploadDropzone onUploaded={(documentId) => {
          setUploadedDocumentId(documentId);
          setAnalysisError("");
          setRefreshKey((key) => key + 1);
        }} />

        <section className="mb-8 rounded-3xl border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Ready to analyze?</h2>
              <p className="mt-1 text-sm text-gray-600">Upload a PDF to unlock the detailed contract report.</p>
            </div>
            <button
              type="button"
              onClick={() => void analyzeDocument()}
              disabled={!uploadedDocumentId || isAnalyzing}
              className="rounded-xl bg-black px-5 py-3 font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {isAnalyzing ? "Generating report…" : "Analyze document"}
            </button>
          </div>
          {analysisError && <p className="mt-4 text-sm text-red-600">{analysisError}</p>}
        </section>

        <RecentUploads refreshKey={refreshKey} onOpenPdf={setSelectedDocumentId} />
      </div>
      <PdfViewer documentId={selectedDocumentId} onClose={() => setSelectedDocumentId(null)} />
    </DashboardLayout>
  );
}
