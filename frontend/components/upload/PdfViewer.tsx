"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { API_URL, authHeaders } from "@/lib/api";

type PdfViewerProps = {
  documentId: string | null;
  onClose: () => void;
};

/** Loads an authenticated PDF as a browser blob so it can be viewed in-app. */
export default function PdfViewer({ documentId, onClose }: PdfViewerProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!documentId) return;
    let objectUrl: string | null = null;

    async function loadPdf() {
      setPreviewUrl(null);
      setError("");
      try {
        const response = await fetch(`${API_URL}/api/upload/${documentId}/preview`, { headers: authHeaders() });
        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.detail ?? "Could not open PDF.");
        }
        objectUrl = URL.createObjectURL(await response.blob());
        setPreviewUrl(objectUrl);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Could not open PDF.");
      }
    }
    void loadPdf();
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [documentId]);

  if (!documentId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="PDF viewer">
      <div className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="font-semibold">PDF preview</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-gray-100" aria-label="Close PDF preview"><X size={22} /></button>
        </div>
        {error && <p className="p-6 text-red-600">{error}</p>}
        {!error && !previewUrl && <p className="p-6 text-gray-500">Loading PDF…</p>}
        {previewUrl && <iframe title="PDF preview" src={previewUrl} className="min-h-0 flex-1" />}
      </div>
    </div>
  );
}
