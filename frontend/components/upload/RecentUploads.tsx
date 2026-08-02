"use client";

import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { API_URL } from "@/lib/api";

type Document = {
  document_id: string;
  original_filename: string;
  size: number;
  uploaded_at: string;
};

type RecentUploadsProps = {
  refreshKey?: number;
  onOpenPdf: (documentId: string) => void;
};

function formatSize(size: number) {
  if (size < 1024 * 1024) {
    return `${Math.ceil(size / 1024)} KB`;
  }

  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export default function RecentUploads({
  refreshKey = 0,
  onOpenPdf,
}: RecentUploadsProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDocuments() {
      try {
        setIsLoading(true);
        setError("");

        const response = await fetch(`${API_URL}/api/upload/`, {
          signal: controller.signal,
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.detail ?? "Could not load PDFs.");
        }

        setDocuments(Array.isArray(result.data) ? result.data : []);
      } catch (loadError) {
        if (loadError instanceof Error && loadError.name === "AbortError") {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load PDFs."
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadDocuments();

    return () => controller.abort();
  }, [refreshKey]);

  return (
    <section className="w-full min-w-0 overflow-hidden rounded-2xl border border-black/10 bg-[#EAE6DB] shadow-sm">
      <header className="border-b border-black/10 px-5 py-4 sm:px-6">
        <h2 className="text-xl font-semibold text-gray-900">Saved PDFs</h2>
        <p className="mt-1 text-sm text-gray-500">
          Open and review your uploaded documents.
        </p>
      </header>

      {isLoading && (
        <div className="px-5 py-8 text-sm text-gray-500 sm:px-6">
          Loading PDFs...
        </div>
      )}

      {!isLoading && error && (
        <div className="px-5 py-8 sm:px-6">
          <p className="text-sm font-medium text-red-600">{error}</p>
        </div>
      )}

      {!isLoading && !error && documents.length === 0 && (
        <div className="px-5 py-10 text-center sm:px-6">
          <FileText className="mx-auto h-9 w-9 text-gray-400" />
          <p className="mt-3 text-sm font-medium text-gray-700">
            No PDFs uploaded yet
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Uploaded documents will appear here.
          </p>
        </div>
      )}

      {!isLoading && !error && documents.length > 0 && (
        <div className="w-full divide-y divide-black/10">
          {documents.map((document) => (
            <button
              key={document.document_id}
              type="button"
              onClick={() => onOpenPdf(document.document_id)}
              className="group flex w-full min-w-0 items-center gap-4 px-5 py-5 text-left transition-colors hover:bg-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 sm:gap-5 sm:px-6"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>

              <div className="min-w-0 flex-1">
                <h3
                  className="truncate text-base font-medium text-gray-900"
                  title={document.original_filename}
                >
                  {document.original_filename}
                </h3>

                <p className="mt-1 truncate text-sm text-gray-500">
                  {formatSize(document.size)}
                  <span className="mx-2">•</span>
                  {new Date(document.uploaded_at).toLocaleString()}
                </p>
              </div>

              <span className="ml-auto shrink-0 text-sm font-semibold text-blue-600 transition group-hover:text-blue-700">
                Open PDF
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}