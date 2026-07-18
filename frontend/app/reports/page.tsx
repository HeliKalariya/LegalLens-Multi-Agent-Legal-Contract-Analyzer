import DashboardLayout from "@/components/layout/DashboardLayout";

/** Shows the reports route while report generation is being implemented. */
export default function ReportsPage() {
  return (
    <DashboardLayout>
      <h1 className="text-3xl font-bold">Reports</h1>
      <p className="mt-2 text-gray-600">Generated contract risk reports will appear here.</p>
    </DashboardLayout>
  );
}
