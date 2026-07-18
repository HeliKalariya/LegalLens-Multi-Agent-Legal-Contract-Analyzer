import DashboardLayout from "@/components/layout/DashboardLayout";

/** Provides the workspace settings route. */
export default function SettingsPage() {
  return (
    <DashboardLayout>
      <h1 className="text-3xl font-bold">Settings</h1>
      <p className="mt-2 text-gray-600">Workspace preferences will be available here.</p>
    </DashboardLayout>
  );
}
