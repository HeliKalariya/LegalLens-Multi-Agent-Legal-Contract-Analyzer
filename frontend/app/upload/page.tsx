"use client";

import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PdfViewer from "@/components/upload/PdfViewer";
import UploadDropzone from "@/components/upload/UploadDropzone";
import RecentUploads from "@/components/upload/RecentUploads";

export default function UploadPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl">
        {/* Heading */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">
            Upload document
          </h1>

          <p className="mt-2 text-gray-600">
            Save a PDF contract locally, then open it again from the list below.
          </p>
        </div>

        <UploadDropzone onUploaded={() => setRefreshKey((key) => key + 1)} />

        <RecentUploads refreshKey={refreshKey} onOpenPdf={setSelectedDocumentId} />
      </div>
      <PdfViewer documentId={selectedDocumentId} onClose={() => setSelectedDocumentId(null)} />
    </DashboardLayout>
  );
}
