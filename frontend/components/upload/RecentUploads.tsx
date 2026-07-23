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

function formatSize(size: number) {
  return size < 1024 * 1024 ? `${Math.ceil(size / 1024)} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`;
}

type RecentUploadsProps = {
  refreshKey?: number;
  onOpenPdf: (documentId: string) => void;
};

export default function RecentUploads({ refreshKey = 0, onOpenPdf }: RecentUploadsProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDocuments() {
      try {
        const response = await fetch(`${API_URL}/api/upload/`);
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail ?? "Could not load PDFs.");
        setDocuments(result.data);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Could not load PDFs.");
      }
    }
    void loadDocuments();
  }, [refreshKey]);

  return (
    <section className="rounded-3xl border bg-white shadow-sm">
      <div className="border-b p-6"><h2 className="text-xl font-semibold">Saved PDFs</h2></div>
      {error && <p className="p-6 text-sm text-red-600">{error}</p>}
      {!error && documents.length === 0 && <p className="p-6 text-gray-500">No PDFs uploaded yet.</p>}
      {documents.map((document) => (
        <button
          key={document.document_id}
          type="button"
          onClick={() => onOpenPdf(document.document_id)}
          className="flex items-center gap-5 border-b p-6 last:border-none hover:bg-gray-50"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50"><FileText className="text-blue-600" /></div>
          <div className="flex-1">
            <h3 className="font-medium">{document.original_filename}</h3>
            <p className="mt-1 text-sm text-gray-500">{formatSize(document.size)} · {new Date(document.uploaded_at).toLocaleString()}</p>
          </div>
          <span className="text-sm font-medium text-blue-600">Open PDF</span>
        </button>
      ))}
    </section>
  );
}
