"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Languages,
  FileText,
} from "lucide-react";

import DashboardLayout from "@/components/layout/DashboardLayout";
import PdfViewer from "@/components/upload/PdfViewer";
import UploadDropzone from "@/components/upload/UploadDropzone";
import RecentUploads from "@/components/upload/RecentUploads";
import { API_URL, authenticatedFetch } from "@/lib/api";
import { clearPageCache } from "@/lib/client-cache";


const LANGUAGES = [
  { code: "en", label: "🇺🇸 English" },
  { code: "hi", label: "🇮🇳 Hindi" },
  { code: "gu", label: "🇮🇳 Gujarati" },
  { code: "es", label: "🇪🇸 Spanish" },
  { code: "fr", label: "🇫🇷 French" },
];

export default function UploadPage() {
  const router = useRouter();

  const [refreshKey, setRefreshKey] = useState(0);

  const [selectedDocumentId, setSelectedDocumentId] =
    useState<string | null>(null);

  const [uploadedDocumentId, setUploadedDocumentId] =
    useState<string | null>(null);

  const [language, setLanguage] = useState("en");

  const [analysisError, setAnalysisError] = useState("");
  const [analysisJob, setAnalysisJob] = useState<{ progress: number; current_step: string } | null>(null);

  async function startAnalysis() {
    if (!uploadedDocumentId) return;
    setAnalysisError("");
    try {
      const response = await authenticatedFetch(`${API_URL}/api/upload/${uploadedDocumentId}/analysis-jobs?language=${language}`, { method: "POST" });
      const job = await response.json();
      if (!response.ok) throw new Error(job.detail ?? "Could not start analysis.");
      setAnalysisJob(job);

      const pollJob = async () => {
        const statusResponse = await authenticatedFetch(`${API_URL}/api/upload/${uploadedDocumentId}/analysis-jobs/${job.job_id}`);
        const statusData = await statusResponse.json();
        if (!statusResponse.ok) throw new Error(statusData.detail ?? "Could not check analysis progress.");
        setAnalysisJob(statusData);
        if (statusData.status === "completed") {
          clearPageCache(`analysis:${uploadedDocumentId}:${language}`);
          clearPageCache(`report:${uploadedDocumentId}:${language}`);
          clearPageCache("documents");
          clearPageCache("dashboard");
          clearPageCache("chat:documents");
          router.push(`/analysis/${uploadedDocumentId}?language=${language}`);
          return;
        }
        if (statusData.status === "failed") throw new Error(statusData.error_message ?? "Analysis failed.");
        window.setTimeout(() => void pollJob().catch((error) => {
          setAnalysisError(error instanceof Error ? error.message : "Analysis failed.");
          setAnalysisJob(null);
        // Polling less frequently reduces background API load while the AI job runs.
        }), 3500);
      };
      window.setTimeout(() => void pollJob().catch((error) => {
        setAnalysisError(error instanceof Error ? error.message : "Analysis failed.");
        setAnalysisJob(null);
      }), 1200);
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "Could not start analysis.");
      setAnalysisJob(null);
    }
  }

  return (
    <DashboardLayout>

      <div className="mx-auto w-full max-w-6xl">

        <div className="mb-6 sm:mb-10">

          <h1 className="text-3xl font-bold sm:text-4xl">
            AI Contract Analyzer
          </h1>

          <p className="mt-3 text-base text-gray-600 sm:text-lg">
            Upload a legal document, choose your preferred
            language, and receive an AI-generated legal report
            with clause explanations, risk analysis, and
            negotiation suggestions.
          </p>

        </div>

        <UploadDropzone
          onUploaded={(documentId) => {
            setUploadedDocumentId(documentId);
            setAnalysisError("");
            // A document-library change must not leave stale cards or lists visible.
            clearPageCache("recent-uploads");
            clearPageCache("documents");
            clearPageCache("dashboard");
            setRefreshKey((v) => v + 1);
          }}
        />

        <section className="mt-6 rounded-2xl border bg-[#EAE6DB] p-5 shadow-sm sm:mt-8 sm:rounded-3xl sm:p-8">

          <div className="flex items-center gap-3 mb-6">

            <Languages className="text-blue-600" />

            <div>

              <h2 className="font-bold text-xl">
                Report Language
              </h2>

              <p className="text-gray-500 text-sm">
                The AI report will be generated in the selected
                language.
              </p>

            </div>

          </div>

          <select
            value={language}
            onChange={(e) =>
              setLanguage(e.target.value)
            }
            className="w-full rounded-xl border p-3 text-base sm:p-4 sm:text-lg"
          >
            {LANGUAGES.map((lang) => (
              <option
                key={lang.code}
                value={lang.code}
              >
                {lang.label}
              </option>
            ))}
          </select>

        </section>

        {uploadedDocumentId && (
        <section className="mt-6 rounded-2xl p-0 sm:mt-8 sm:rounded-3xl sm:p-8">

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">

            <div>

              {/* <div className="flex items-center gap-2">

                <Sparkles className="text-blue-600"/>

                <h2 className="text-2xl font-bold">
                  Ready to Analyze?
                </h2>

              </div>

              <p className="mt-3 text-gray-600">

                Our AI will automatically:

              </p> */}

              {/* <ul className="mt-4 space-y-2 text-gray-700">

                <li> Verify the uploaded document is legal.</li>

                <li> Extract important clauses.</li>

                <li>✅ Detect risky provisions.</li>

                <li>✅ Explain clauses in plain language.</li>

                <li>✅ Suggest negotiation improvements.</li>

                <li>✅ Generate a professional report in your selected language.</li>

              </ul> */}

            </div>

            <div className="w-full md:min-w-[240px] md:w-auto">

              <button
                onClick={() => void startAnalysis()}
                disabled={Boolean(analysisJob)}
                className="w-full rounded-2xl bg-black py-3 text-base font-semibold text-white hover:bg-gray-900 disabled:bg-gray-300 sm:py-4 sm:text-lg"
              >
                Analyze document
              </button>

            </div>

          </div>

          {analysisError && (

            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-600">

              {analysisError}

            </div>

          )}

        </section>
        )}

        <section className="mt-8 sm:mt-10">

          <div className="mb-5 flex items-center gap-2">

            <FileText className="text-blue-600"/>

            <h2 className="text-xl font-bold sm:text-2xl">
              Recent Uploads
            </h2>

          </div>

          <RecentUploads
            refreshKey={refreshKey}
            onOpenPdf={setSelectedDocumentId}
          />

        </section>

      </div>

      <PdfViewer
        documentId={selectedDocumentId}
        onClose={() =>
          setSelectedDocumentId(null)
        }
      />

      {analysisJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#F7F3EA] p-6 text-center shadow-2xl sm:p-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#E8F2FC] text-2xl text-[#0875D1]">✦</div>
            <h2 className="mt-5 text-xl font-bold text-[#181211]">AI is analyzing your document</h2>
            <p className="mt-2 text-sm leading-6 text-[#67758A]">Our legal specialists are extracting clauses, assessing risks, simplifying language, and preparing negotiation guidance.</p>
            <div className="mt-6 h-2 overflow-hidden rounded-full bg-[#DDD7CC]"><div className="h-full rounded-full bg-[#0875D1] transition-all" style={{ width: `${Math.max(8, analysisJob.progress)}%` }} /></div>
            <p className="mt-3 text-sm font-semibold capitalize text-[#0875D1]">{analysisJob.current_step} · {analysisJob.progress}%</p>
            <p className="mt-5 text-xs text-[#67758A]">Please keep this page open. You&apos;ll be redirected when analysis is complete.</p>
          </div>
        </div>
      )}

    </DashboardLayout>
  );
}
