"use client";

import { X } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

type PdfViewerProps = {
  documentId: string | null;
  onClose: () => void;
};

/** Shows a selected PDF without navigating away from the current page. */
export default function PdfViewer({ documentId, onClose }: PdfViewerProps) {
  if (!documentId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="PDF viewer">
      <div className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="font-semibold">PDF preview</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-gray-100" aria-label="Close PDF preview">
            <X size={22} />
          </button>
        </div>
        <iframe
          title="PDF preview"
          src={`${API_URL}/api/upload/${documentId}/download`}
          className="min-h-0 flex-1"
        />
      </div>
    </div>
  );
}
