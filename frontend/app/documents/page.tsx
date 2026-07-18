"use client";

import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PdfViewer from "@/components/upload/PdfViewer";
import RecentUploads from "@/components/upload/RecentUploads";

/** Lists analyzed documents once the document API is connected. */
export default function DocumentsPage() {
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-bold">Documents</h1>
        <p className="mb-8 mt-2 text-gray-600">All locally saved PDF contracts.</p>
        <RecentUploads onOpenPdf={setSelectedDocumentId} />
      </div>
      <PdfViewer documentId={selectedDocumentId} onClose={() => setSelectedDocumentId(null)} />
    </DashboardLayout>
  );
}
