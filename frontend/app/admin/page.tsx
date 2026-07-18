import DashboardLayout from "@/components/layout/DashboardLayout";

/** Displays a lightweight placeholder until admin tools are connected. */
export default function AdminPage() {
  return (
    <DashboardLayout>
      <h1 className="text-3xl font-bold">Administration</h1>
      <p className="mt-2 text-gray-600">Manage users and workspace settings here.</p>
    </DashboardLayout>
  );
}
