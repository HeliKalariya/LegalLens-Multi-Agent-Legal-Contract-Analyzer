import DashboardLayout from "@/components/layout/DashboardLayout";

/** Lists analyzed documents once the document API is connected. */
export default function DocumentsPage() {
  return (
    <DashboardLayout>
      <h1 className="text-3xl font-bold">Documents</h1>
      <p className="mt-2 text-gray-600">Your uploaded contracts will appear here.</p>
    </DashboardLayout>
  );
}
