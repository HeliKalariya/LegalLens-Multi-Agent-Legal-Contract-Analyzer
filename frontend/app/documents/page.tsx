"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, Eye, FileSearch2, FileText, LoaderCircle, MoreVertical, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import DashboardLayout from "@/components/layout/DashboardLayout";
import PdfViewer from "@/components/upload/PdfViewer";
import { API_URL, authenticatedFetch } from "@/lib/api";
import { clearPageCache, readPageCache, writePageCache } from "@/lib/client-cache";

type Document = {
  document_id: string;
  original_filename: string;
  uploaded_at: string;
  document_type?: string;
  clause_count?: number;
  risk_level?: "high" | "medium" | "safe" | "pending";
  analysis_status: string;
  analysis_language?: string;
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [documentToRename, setDocumentToRename] = useState<Document | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [previewDocumentId, setPreviewDocumentId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const cachedDocuments = readPageCache<Document[]>("documents");
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
        const response = await authenticatedFetch(`${API_URL}/api/upload/`, { signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail ?? "Could not load documents.");
        const fetchedDocuments = Array.isArray(result.data) ? result.data : [];
        setDocuments(fetchedDocuments);
        writePageCache<Document[]>("documents", fetchedDocuments);
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

  const filteredDocuments = useMemo(() => documents, [documents]);

  function openRename(document: Document) {
    setDocumentToRename(document);
    setRenameValue(document.original_filename);
  }

  async function saveRename() {
    if (!documentToRename || !renameValue.trim()) return;
    setIsRenaming(true);
    try {
      const response = await authenticatedFetch(`${API_URL}/api/upload/${documentToRename.document_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: renameValue }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail ?? "Could not rename the document.");
      const updated = result.data as Document;
      setDocuments((current) => current.map((item) => item.document_id === updated.document_id ? { ...item, ...updated } : item));
      clearPageCache("documents");
      clearPageCache("recent-uploads");
      clearPageCache("dashboard");
      setDocumentToRename(null);
      toast.success("Document renamed.");
    } catch (renameError) {
      toast.error(renameError instanceof Error ? renameError.message : "Could not rename the document.");
    } finally {
      setIsRenaming(false);
    }
  }

  async function confirmDelete() {
    if (!documentToDelete) return;
    const document = documentToDelete;
    setDeletingId(document.document_id);
    try {
      const response = await authenticatedFetch(`${API_URL}/api/upload/${document.document_id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail ?? "Could not delete the document.");
      setDocuments((current) => current.filter((item) => item.document_id !== document.document_id));
      clearPageCache("documents");
      clearPageCache("recent-uploads");
      clearPageCache("dashboard");
      clearPageCache("chat:documents");
      setDocumentToDelete(null);
      toast.success("Document deleted.");
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "Could not delete the document.");
    } finally {
      setDeletingId(null);
    }
  }

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
              const analysisLanguage = document.analysis_language ?? "en";
              return (
                <article key={document.document_id} className="relative flex min-w-0 flex-col rounded-2xl border border-black/15 bg-[#EAE6DB] p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-black/15 bg-[#F7F3EA] text-[#0875D1]">
                      <FileText className="h-6 w-6" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${riskStyles[riskLevel]}`}>
                        <span className="mr-1.5">•</span>{riskLabels[riskLevel]}
                      </span>
                      <button type="button" onClick={() => setOpenMenuId((current) => current === document.document_id ? null : document.document_id)} aria-label={`Actions for ${document.original_filename}`} aria-expanded={openMenuId === document.document_id} className="grid h-8 w-8 place-items-center rounded-lg text-[#526174] transition hover:bg-black/10 hover:text-[#181211]"><MoreVertical className="h-5 w-5" /></button>
                    </div>
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
    href={`/analysis/${document.document_id}?language=${encodeURIComponent(analysisLanguage)}`}
    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#0875D1] bg-[#0875D1] px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#065FA8] hover:shadow-md"
  >
    <FileSearch2 className="h-4 w-4 text-white" /> Analysis
  </Link>
  {document.analysis_status === "analyzed" ? (
    <Link
      href={`/reports/${document.document_id}?language=${encodeURIComponent(analysisLanguage)}`}
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

{openMenuId === document.document_id && <div className="absolute right-5 top-14 z-20 w-40 overflow-hidden rounded-xl border border-black/15 bg-[#F7F3EA] p-1.5 shadow-xl sm:right-6"><button type="button" onClick={() => { setOpenMenuId(null); setPreviewDocumentId(document.document_id); }} className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-medium text-[#181211] transition hover:bg-black/5"><Eye className="h-4 w-4 text-[#0875D1]" /> View</button><button type="button" onClick={() => { setOpenMenuId(null); openRename(document); }} className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-medium text-[#181211] transition hover:bg-black/5"><Pencil className="h-4 w-4 text-[#0875D1]" /> Edit</button><button type="button" onClick={() => { setOpenMenuId(null); setDocumentToDelete(document); }} className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-medium text-red-700 transition hover:bg-red-50"><Trash2 className="h-4 w-4" /> Delete</button></div>}
                </article>
              );
            })}
          </div>
        )}

        {documentToRename && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4" onMouseDown={() => !isRenaming && setDocumentToRename(null)}><section role="dialog" aria-modal="true" aria-labelledby="rename-document-title" className="w-full max-w-md rounded-2xl border border-black/15 bg-[#F7F3EA] p-6 shadow-2xl sm:p-7" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-4"><span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-100 text-[#0875D1]"><Pencil size={21} /></span><button type="button" onClick={() => setDocumentToRename(null)} disabled={isRenaming} aria-label="Close rename dialog" className="grid h-8 w-8 place-items-center rounded-lg text-[#526174] hover:bg-black/5"><X size={19} /></button></div><h2 id="rename-document-title" className="mt-5 text-xl font-bold text-[#181211]">Edit document name</h2><p className="mt-2 text-sm leading-6 text-[#526174]">Only the display name changes. The uploaded file and its analysis stay the same.</p><label className="mt-5 block"><span className="mb-2 block text-sm font-semibold text-[#181211]">Document name</span><input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} autoFocus className="w-full rounded-xl border border-black/15 bg-[#EAE6DB] px-4 py-3 text-sm text-[#181211] outline-none focus:border-[#0875D1]" /></label><div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={() => setDocumentToRename(null)} disabled={isRenaming} className="min-h-11 rounded-xl border border-black/15 bg-white px-5 text-sm font-semibold text-[#181211] disabled:opacity-60">Cancel</button><button type="button" onClick={() => void saveRename()} disabled={isRenaming || !renameValue.trim()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#181211] px-5 text-sm font-semibold text-white disabled:opacity-60">{isRenaming && <LoaderCircle className="animate-spin" size={17} />}{isRenaming ? "Saving..." : "Save name"}</button></div></section></div>}

        {documentToDelete && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4" onMouseDown={() => !deletingId && setDocumentToDelete(null)}><section role="dialog" aria-modal="true" aria-labelledby="delete-document-title" className="w-full max-w-md rounded-2xl border border-black/15 bg-[#F7F3EA] p-6 shadow-2xl sm:p-7" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-4"><span className="grid h-11 w-11 place-items-center rounded-xl bg-red-100 text-red-600"><AlertTriangle size={22} /></span><button type="button" onClick={() => setDocumentToDelete(null)} disabled={Boolean(deletingId)} aria-label="Close delete dialog" className="grid h-8 w-8 place-items-center rounded-lg text-[#526174] hover:bg-black/5"><X size={19} /></button></div><h2 id="delete-document-title" className="mt-5 text-xl font-bold text-[#181211]">Delete document?</h2><p className="mt-2 text-sm leading-6 text-[#526174]">This permanently removes the document, analysis, and generated reports.</p><p className="mt-4 truncate rounded-xl border border-black/10 bg-[#EAE6DB] px-4 py-3 text-sm font-semibold text-[#181211]" title={documentToDelete.original_filename}>{documentToDelete.original_filename}</p><div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={() => setDocumentToDelete(null)} disabled={Boolean(deletingId)} className="min-h-11 rounded-xl border border-black/15 bg-white px-5 text-sm font-semibold text-[#181211] disabled:opacity-60">Cancel</button><button type="button" onClick={() => void confirmDelete()} disabled={Boolean(deletingId)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-semibold text-white disabled:opacity-60">{deletingId ? <LoaderCircle className="animate-spin" size={17} /> : <Trash2 size={17} />}{deletingId ? "Deleting..." : "Delete document"}</button></div></section></div>}
        <PdfViewer documentId={previewDocumentId} onClose={() => setPreviewDocumentId(null)} />
      </div>
    </DashboardLayout>
  );
}
