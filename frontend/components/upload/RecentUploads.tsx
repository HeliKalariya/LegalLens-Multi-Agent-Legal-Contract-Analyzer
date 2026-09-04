"use client";

import { useEffect, useState } from "react";
import { Eye, FileText } from "lucide-react";

import { API_URL, authenticatedFetch } from "@/lib/api";
import { readPageCache, writePageCache } from "@/lib/client-cache";

type Document = { document_id: string; original_filename: string; size: number; uploaded_at: string };
type RecentUploadsProps = { refreshKey?: number; onOpenPdf: (documentId: string) => void };

function formatSize(size: number) {
  return size < 1024 * 1024 ? `${Math.ceil(size / 1024)} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`;
}

/** Lists uploaded documents and confirms destructive deletion with an in-app modal. */
export default function RecentUploads({ refreshKey = 0, onOpenPdf }: RecentUploadsProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const cachedDocuments = refreshKey === 0 ? readPageCache<Document[]>("recent-uploads", 30_000) : null;
    if (cachedDocuments) {
      queueMicrotask(() => {
        if (controller.signal.aborted) return;
        setDocuments(cachedDocuments);
        setIsLoading(false);
      });
    }
    async function loadDocuments() {
      try {
        if (!cachedDocuments) setIsLoading(true);
        setError("");
        // The upload page only displays recent history, so avoid fetching a large library.
        const response = await authenticatedFetch(`${API_URL}/api/upload/?limit=5`, { signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail ?? "Could not load documents.");
        const fetchedDocuments = Array.isArray(result.data) ? result.data : [];
        setDocuments(fetchedDocuments);
        writePageCache<Document[]>("recent-uploads", fetchedDocuments);
      } catch (loadError) {
        if (loadError instanceof Error && loadError.name === "AbortError") return;
        setError(loadError instanceof Error ? loadError.message : "Could not load documents.");
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
        <p className="mt-1 text-sm text-gray-500">Open and review your uploaded documents.</p>
      </header>

      {isLoading && <div className="px-5 py-8 text-sm text-gray-500 sm:px-6">Loading PDFs...</div>}
      {!isLoading && error && <div className="px-5 py-8 sm:px-6"><p className="text-sm font-medium text-red-600">{error}</p></div>}
      {!isLoading && !error && documents.length === 0 && (
        <div className="px-5 py-10 text-center sm:px-6"><FileText className="mx-auto h-9 w-9 text-gray-400" /><p className="mt-3 text-sm font-medium text-gray-700">No PDFs uploaded yet</p><p className="mt-1 text-sm text-gray-500">Uploaded documents will appear here.</p></div>
      )}
      {!isLoading && !error && documents.length > 0 && (
        <div className="w-full divide-y divide-black/10">
          {documents.map((document) => (
            <div key={document.document_id} className="flex min-w-0 items-center gap-3 px-4 py-4 transition-colors hover:bg-white/50 sm:gap-5 sm:px-6 sm:py-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 sm:h-12 sm:w-12"><FileText className="h-5 w-5 text-blue-600 sm:h-6 sm:w-6" /></div>
              <div className="min-w-0 flex-1 overflow-hidden"><h3 className="truncate text-sm font-medium text-gray-900 sm:text-base" title={document.original_filename}>{document.original_filename}</h3><p className="mt-1 truncate text-xs text-gray-500 sm:text-sm">{formatSize(document.size)} <span className="mx-1">•</span><span className="hidden sm:inline">{new Date(document.uploaded_at).toLocaleDateString()}</span></p></div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button type="button" onClick={() => onOpenPdf(document.document_id)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-200 text-blue-600 transition-colors hover:bg-blue-50" aria-label={`View ${document.original_filename}`} title="View PDF"><Eye className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
