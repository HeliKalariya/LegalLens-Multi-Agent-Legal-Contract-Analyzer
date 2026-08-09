"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Eye, FileText, LoaderCircle, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { API_URL, authenticatedFetch } from "@/lib/api";

type Document = { document_id: string; original_filename: string; size: number; uploaded_at: string };
type RecentUploadsProps = { refreshKey?: number; onOpenPdf: (documentId: string) => void; onDeleted?: (documentId: string) => void };

function formatSize(size: number) {
  return size < 1024 * 1024 ? `${Math.ceil(size / 1024)} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`;
}

/** Lists uploaded documents and confirms destructive deletion with an in-app modal. */
export default function RecentUploads({ refreshKey = 0, onOpenPdf, onDeleted }: RecentUploadsProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function loadDocuments() {
      try {
        setIsLoading(true);
        setError("");
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
  }, [refreshKey]);

  async function confirmDelete() {
    if (!documentToDelete) return;
    const document = documentToDelete;
    setDeletingId(document.document_id);
    try {
      const response = await authenticatedFetch(`${API_URL}/api/upload/${document.document_id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail ?? "Could not delete the document.");
      setDocuments((current) => current.filter((item) => item.document_id !== document.document_id));
      onDeleted?.(document.document_id);
      setDocumentToDelete(null);
      toast.success("Document deleted.");
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "Could not delete the document.");
    } finally {
      setDeletingId(null);
    }
  }

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
                <button type="button" onClick={() => setDocumentToDelete(document)} disabled={deletingId === document.document_id} className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60" aria-label={`Delete ${document.original_filename}`} title="Delete PDF"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {documentToDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4" role="presentation" onMouseDown={() => !deletingId && setDocumentToDelete(null)}>
          <section role="dialog" aria-modal="true" aria-labelledby="delete-document-title" className="w-full max-w-md rounded-2xl border border-black/15 bg-[#F7F3EA] p-6 shadow-2xl sm:p-7" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-red-100 text-red-600"><AlertTriangle size={22} /></div>
              <button type="button" onClick={() => setDocumentToDelete(null)} disabled={Boolean(deletingId)} aria-label="Close delete dialog" className="grid h-8 w-8 place-items-center rounded-lg text-[#526174] transition hover:bg-black/5 hover:text-[#181211] disabled:opacity-50"><X size={19} /></button>
            </div>
            <h2 id="delete-document-title" className="mt-5 text-xl font-bold text-[#181211]">Delete document?</h2>
            <p className="mt-2 text-sm leading-6 text-[#526174]">This will permanently remove the document, its analysis, and any generated reports.</p>
            <div className="mt-4 rounded-xl border border-black/10 bg-[#EAE6DB] px-4 py-3"><p className="truncate text-sm font-semibold text-[#181211]" title={documentToDelete.original_filename}>{documentToDelete.original_filename}</p><p className="mt-1 text-xs text-[#67758A]">{formatSize(documentToDelete.size)}</p></div>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setDocumentToDelete(null)} disabled={Boolean(deletingId)} className="min-h-11 rounded-xl border border-black/15 bg-white px-5 text-sm font-semibold text-[#181211] transition hover:bg-gray-50 disabled:opacity-60">Cancel</button>
              <button type="button" onClick={() => void confirmDelete()} disabled={Boolean(deletingId)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60">{deletingId ? <LoaderCircle className="animate-spin" size={17} /> : <Trash2 size={17} />}{deletingId ? "Deleting..." : "Delete document"}</button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
