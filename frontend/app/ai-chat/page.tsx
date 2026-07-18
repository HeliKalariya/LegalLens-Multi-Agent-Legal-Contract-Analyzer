import DashboardLayout from "@/components/layout/DashboardLayout";

/** Provides a ready route for the future contract-analysis chat experience. */
export default function AiChatPage() {
  return (
    <DashboardLayout>
      <h1 className="text-3xl font-bold">AI contract chat</h1>
      <p className="mt-2 text-gray-600">Upload a contract to start asking questions about it.</p>
    </DashboardLayout>
  );
}
