"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Languages,
  FileText,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import DashboardLayout from "@/components/layout/DashboardLayout";
import PdfViewer from "@/components/upload/PdfViewer";
import UploadDropzone from "@/components/upload/UploadDropzone";
import RecentUploads from "@/components/upload/RecentUploads";

import { API_URL, authenticatedFetch } from "@/lib/api";

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

  const [isAnalyzing, setIsAnalyzing] =
    useState(false);

  async function analyzeDocument() {
    if (!uploadedDocumentId) return;

    setIsAnalyzing(true);
    setAnalysisError("");

    try {
      const analyze = await authenticatedFetch(
        `${API_URL}/api/upload/${uploadedDocumentId}/analyze`,
        {
          method: "POST",
        }
      );

      const analyzeResult = await analyze.json();

      if (!analyze.ok) {
        throw new Error(
          analyzeResult.detail ?? "Analysis failed."
        );
      }

      router.push(
        `/analysis/${uploadedDocumentId}?language=${language}`
      );
      toast.success("Analysis completed successfully.");
    } catch (err) {
      setAnalysisError(
        err instanceof Error
          ? err.message
          : "Analysis failed."
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <DashboardLayout>

      <div className="mx-auto max-w-6xl">

        <div className="mb-10">

          <h1 className="text-4xl font-bold">
            AI Contract Analyzer
          </h1>

          <p className="mt-3 text-gray-600 text-lg">
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
            setRefreshKey((v) => v + 1);
          }}
        />

        <section className="mt-8 rounded-3xl border bg-[#EAE6DB] p-8 shadow-sm">

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
            className="w-full rounded-xl border p-4 text-lg"
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

        <section className="mt-8 rounded-3xl  p-8">

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

            <div className="min-w-[240px]">

              <button
                onClick={() => void analyzeDocument()}
                disabled={
                  !uploadedDocumentId ||
                  isAnalyzing
                }
                className="w-full rounded-2xl bg-black py-4 text-lg font-semibold text-white hover:bg-gray-900 disabled:bg-gray-300"
              >
                {isAnalyzing
                  ? "Generating Report..."
                  : "Generate AI Report"}
              </button>

            </div>

          </div>

          {analysisError && (

            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-600">

              {analysisError}

            </div>

          )}

        </section>

        <section className="mt-10">

          <div className="mb-5 flex items-center gap-2">

            <FileText className="text-blue-600"/>

            <h2 className="text-2xl font-bold">
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

    </DashboardLayout>
  );
}
