import DashboardLayout from "@/components/layout/DashboardLayout";

export default function HomePage() {
  return (
    <DashboardLayout>
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <p className="mt-2 text-gray-600">
        Welcome to ContractIQ Insights
      </p>
    </DashboardLayout>
  );
}