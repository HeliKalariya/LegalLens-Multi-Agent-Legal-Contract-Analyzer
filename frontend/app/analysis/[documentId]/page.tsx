"use client";

import dynamic from "next/dynamic";

// PDF.js needs browser APIs such as DOMMatrix, so never evaluate it during SSR.
const AnalysisWorkspace = dynamic(() => import("@/components/analysis/AnalysisWorkspace"), {
  ssr: false,
  loading: () => <div className="p-6 text-sm text-[#67758A]">Loading document analysis...</div>,
});

export default function AnalysisPage() {
  return <AnalysisWorkspace />;
}
