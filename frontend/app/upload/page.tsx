import DashboardLayout from "@/components/layout/DashboardLayout";
import UploadDropzone from "@/components/upload/UploadDropzone";
import RecentUploads from "@/components/upload/RecentUploads";

export default function UploadPage() {
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl">
        {/* Heading */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">
            Upload document
          </h1>

          <p className="mt-2 text-gray-600">
            Drop a PDF or DOCX contract. We will extract every clause and score
            its risk.
          </p>
        </div>

        <UploadDropzone />

        <RecentUploads />
      </div>
    </DashboardLayout>
  );
}