"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ShieldCheck,
  FileText,
  Globe,
  Calendar,
  Share2,
  Download,
} from "lucide-react";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { API_URL } from "@/lib/api";

type Report = {
  summary: {
    filename: string;
    total_pages: number;
    total_clauses: number;
    overall_risk_score: number;
    overall_risk_label: string;
    high_risk_count: number;
    medium_risk_count: number;
    safe_count: number;
    negotiable_count: number;
    analyzed_at: string;
    language: string;
  };

  executive_summary?: string;

  negotiation_recommendations?: string[];

  plain_language_summary?: string;

  top_risks: {
    rank: number;
    title: string;
    risk_level: "high" | "medium" | "safe";
    page: number;
    explanation: string;
  }[];
};

const badgeColor = (risk: string) => {
  switch (risk.toLowerCase()) {
    case "high":
    case "high risk":
      return "bg-red-100 text-red-700 border-red-300";

    case "medium":
    case "moderate risk":
      return "bg-yellow-100 text-yellow-700 border-yellow-300";

    default:
      return "bg-green-100 text-green-700 border-green-300";
  }
};

export default function AnalysisPage() {

  const { documentId } = useParams<{ documentId: string }>();

  const search = useSearchParams();

  const language = search.get("language") ?? "en";

  const [report, setReport] = useState<Report | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  useEffect(() => {

    async function loadReport() {

      try {

        const res = await fetch(
          `${API_URL}/api/upload/${documentId}/report?language=${language}`
        );

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.detail);
        }

        setReport(data);

      } catch (err) {

        if (err instanceof Error) {
          setError(err.message);
        }

      } finally {
        setLoading(false);
      }

    }

    loadReport();

  }, [documentId, language]);

  const score = report?.summary.overall_risk_score ?? 0;

  const radius = 80;

  const circumference = 2 * Math.PI * radius;

  const offset =
    circumference - (score / 100) * circumference;

  return (

    <DashboardLayout>

      <div className="min-h-screen bg-[#F7F3EC]">

        <div className="mx-auto max-w-7xl p-8">

          <Link
            href="/upload"
            className="text-blue-600 hover:underline"
          >
            ← Upload another document
          </Link>

          {loading && (
            <div className="mt-10 bg-white rounded-3xl p-10">
              Loading AI Report...
            </div>
          )}

          {error && (
            <div className="mt-10 rounded-3xl bg-red-100 p-10 text-red-600">
              {error}
            </div>
          )}

          {report && (

            <>

              {/* Header */}

              <div className="mt-8 flex items-start justify-between">

                <div>

                  <p className="uppercase tracking-widest text-gray-500">

                    AI REPORT

                  </p>

                  <h1 className="mt-2 text-5xl font-bold">

                    {report.summary.filename}

                  </h1>

                  <p className="mt-3 text-gray-500">

                    Generated{" "}

                    {new Date(
                      report.summary.analyzed_at
                    ).toLocaleDateString()}

                    {" • "}

                    {report.summary.total_clauses} clauses analyzed

                  </p>

                </div>

                <div className="flex gap-3">

                  <button className="rounded-xl border bg-white px-5 py-3 flex items-center gap-2">

                    <Share2 size={18} />

                    Share

                  </button>

                  <button className="rounded-xl bg-black text-white px-6 py-3 flex items-center gap-2">

                    <Download size={18} />

                    Download PDF

                  </button>

                </div>

              </div>

              {/* Executive Summary */}

              <section className="mt-8 rounded-3xl border bg-white p-10">

                <div className="grid lg:grid-cols-[280px_1fr] gap-10">

                  {/* Circular Score */}

                  <div className="flex justify-center">

                    <div className="relative h-52 w-52">

                      <svg
                        viewBox="0 0 200 200"
                        className="-rotate-90"
                      >

                        <circle
                          cx="100"
                          cy="100"
                          r={radius}
                          fill="none"
                          stroke="#E5E7EB"
                          strokeWidth="15"
                        />

                        <circle
                          cx="100"
                          cy="100"
                          r={radius}
                          fill="none"
                          stroke="#DC2626"
                          strokeWidth="15"
                          strokeLinecap="round"
                          strokeDasharray={circumference}
                          strokeDashoffset={offset}
                        />

                      </svg>

                      <div className="absolute inset-0 flex flex-col items-center justify-center">

                        <div className="text-6xl font-bold">

                          {report.summary.overall_risk_score}

                        </div>

                        <div className="text-gray-500">

                          /100 Risk

                        </div>

                      </div>

                    </div>

                  </div>

                  {/* Summary */}

                  <div>

                    <span
                      className={`rounded-full border px-4 py-2 font-semibold ${badgeColor(
                        report.summary.overall_risk_label
                      )}`}
                    >

                      {report.summary.overall_risk_label}

                    </span>

                    <h2 className="mt-6 text-4xl font-bold leading-tight">

                      {report.executive_summary ??
                        "This agreement contains several unusually aggressive terms."}

                    </h2>

                    <p className="mt-5 text-lg text-gray-600 leading-8">

                      {report.plain_language_summary ??
                        "AI analyzed the complete contract and identified multiple important clauses that require attention before signing."}

                    </p>

                  </div>

                </div>

              </section>

              {/* Statistics */}

              <div className="mt-8 grid gap-5 md:grid-cols-4">

                <div className="rounded-3xl border bg-white p-6">

                  <p className="text-gray-500">

                    High Risk Clauses

                  </p>

                  <h3 className="mt-4 text-5xl font-bold text-red-600">

                    {report.summary.high_risk_count}

                  </h3>

                </div>

                <div className="rounded-3xl border bg-white p-6">

                  <p className="text-gray-500">

                    Medium Risk Clauses

                  </p>

                  <h3 className="mt-4 text-5xl font-bold text-yellow-600">

                    {report.summary.medium_risk_count}

                  </h3>

                </div>

                <div className="rounded-3xl border bg-white p-6">

                  <p className="text-gray-500">

                    Safe Clauses

                  </p>

                  <h3 className="mt-4 text-5xl font-bold text-green-600">

                    {report.summary.safe_count}

                  </h3>

                </div>

                <div className="rounded-3xl border bg-white p-6">

                  <p className="text-gray-500">

                    Negotiable Clauses

                  </p>

                  <h3 className="mt-4 text-5xl font-bold">

                    {report.summary.negotiable_count}

                  </h3>

                </div>

              </div>

                            {/* ================= TOP RISK CLAUSES ================= */}

              <section className="mt-10 rounded-3xl border bg-white p-8">

                <div className="flex items-center gap-3">

                  <AlertTriangle
                    className="text-red-600"
                    size={28}
                  />

                  <div>

                    <h2 className="text-3xl font-bold">

                      Top Risk Clauses

                    </h2>

                    <p className="text-gray-500 mt-1">

                      These clauses have the highest legal risk and should be
                      reviewed before signing.

                    </p>

                  </div>

                </div>

                <div className="mt-8 space-y-6">

                  {report.top_risks.length === 0 ? (

                    <div className="rounded-2xl border bg-gray-50 p-8 text-center text-gray-500">

                      No high-risk clauses detected.

                    </div>

                  ) : (

                    report.top_risks.map((risk) => (

                      <div
                        key={risk.rank}
                        className="rounded-3xl border bg-[#FAFAFA] p-6 transition hover:shadow-md"
                      >

                        <div className="flex flex-col lg:flex-row lg:justify-between gap-6">

                          <div className="flex gap-5 flex-1">

                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-lg font-bold">

                              {risk.rank}

                            </div>

                            <div className="flex-1">

                              <div className="flex flex-wrap items-center gap-3">

                                <h3 className="text-2xl font-bold">

                                  {risk.title}

                                </h3>

                                <span
                                  className={`rounded-full border px-4 py-1 text-sm font-semibold ${badgeColor(
                                    risk.risk_level
                                  )}`}
                                >
                                  {risk.risk_level.toUpperCase()}
                                </span>

                              </div>

                              <p className="mt-2 text-sm text-gray-500">

                                Page {risk.page}

                              </p>

                              <p className="mt-5 leading-8 text-gray-700">

                                {risk.explanation}

                              </p>

                            </div>

                          </div>

                        </div>

                      </div>

                    ))

                  )}

                </div>

              </section>



              {/* ================= NEGOTIATION RECOMMENDATIONS ================= */}

              <section className="mt-10 rounded-3xl border bg-white p-8">

                <div className="flex items-center gap-3">

                  <ShieldCheck
                    className="text-blue-600"
                    size={28}
                  />

                  <div>

                    <h2 className="text-3xl font-bold">

                      Negotiation Recommendations

                    </h2>

                    <p className="mt-1 text-gray-500">

                      AI-generated recommendations based on the detected
                      contract risks.

                    </p>

                  </div>

                </div>

                <div className="mt-8 space-y-4">

                  {report.negotiation_recommendations &&
                  report.negotiation_recommendations.length > 0 ? (

                    report.negotiation_recommendations.map(
                      (recommendation, index) => (

                        <div
                          key={index}
                          className="flex items-start gap-5 rounded-2xl border p-5 hover:bg-gray-50"
                        >

                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white font-bold">

                            {index + 1}

                          </div>

                          <p className="text-gray-700 leading-7">

                            {recommendation}

                          </p>

                        </div>

                      )
                    )

                  ) : (

                    <>
                      <div className="flex gap-5 rounded-2xl border p-5">

                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white font-bold">

                          1

                        </div>

                        <p>

                          Review all high-risk clauses with a qualified legal
                          professional before signing.

                        </p>

                      </div>

                      <div className="flex gap-5 rounded-2xl border p-5">

                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white font-bold">

                          2

                        </div>

                        <p>

                          Negotiate liability, payment, and termination clauses
                          whenever possible.

                        </p>

                      </div>

                      <div className="flex gap-5 rounded-2xl border p-5">

                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white font-bold">

                          3

                        </div>

                        <p>

                          Ensure confidential information is properly protected
                          throughout the agreement.

                        </p>

                      </div>

                      <div className="flex gap-5 rounded-2xl border p-5">

                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white font-bold">

                          4

                        </div>

                        <p>

                          Clarify ambiguous clauses and request revisions before
                          execution.

                        </p>

                      </div>

                      <div className="flex gap-5 rounded-2xl border p-5">

                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white font-bold">

                          5

                        </div>

                        <p>

                          Keep a signed copy of the final negotiated agreement
                          for future reference.

                        </p>

                      </div>
                    </>

                  )}

                </div>

              </section>

              {/* ========================================= */}
{/* TOP RISKS */}
{/* ========================================= */}

<section className="mt-8 rounded-3xl border bg-white p-8 shadow-sm">
  <div className="flex items-center gap-3 mb-6">
    <AlertTriangle className="h-6 w-6 text-red-600" />
    <div>
      <h2 className="text-2xl font-bold">Top Risk Clauses</h2>
      <p className="text-gray-500">
        Highest priority clauses detected by AI.
      </p>
    </div>
  </div>

  <div className="space-y-5">
    {report.top_risks.map((risk) => (
      <div
        key={risk.rank}
        className="rounded-2xl border p-6 hover:border-gray-300 transition"
      >
        <div className="flex justify-between items-start">

          <div>

            <div className="flex items-center gap-3">

              <div className="h-10 w-10 rounded-full bg-black text-white flex items-center justify-center font-bold">
                {risk.rank}
              </div>

              <div>
                <h3 className="text-xl font-semibold">
                  {risk.title}
                </h3>

                <p className="text-sm text-gray-500">
                  Page {risk.page}
                </p>
              </div>

            </div>

          </div>

          <span
            className={`rounded-full px-4 py-2 text-sm font-semibold ${badgeColor(
              risk.risk_level
            )}`}
          >
            {risk.risk_level.toUpperCase()}
          </span>

        </div>

        <div className="mt-5 rounded-xl bg-gray-50 p-5">
          <p className="leading-7 text-gray-700">
            {risk.explanation}
          </p>
        </div>

      </div>
    ))}
  </div>
</section>

{/* ========================================= */}
{/* REPORT INFORMATION */}
{/* ========================================= */}

<section className="mt-8 rounded-3xl border bg-white p-8 shadow-sm">

  <div className="flex items-center gap-3 mb-6">
    <ShieldCheck className="h-6 w-6 text-blue-600" />
    <div>
      <h2 className="text-2xl font-bold">
        Report Information
      </h2>
      <p className="text-gray-500">
        Details about this AI-generated analysis.
      </p>
    </div>
  </div>

  <div className="grid md:grid-cols-2 gap-6">

    <div className="rounded-xl bg-gray-50 p-5">
      <p className="text-gray-500 text-sm">
        Report Language
      </p>

      <p className="mt-2 text-lg font-semibold uppercase">
        {report.summary.language}
      </p>
    </div>

    <div className="rounded-xl bg-gray-50 p-5">
      <p className="text-gray-500 text-sm">
        Generated On
      </p>

      <p className="mt-2 text-lg font-semibold">
        {new Date(report.summary.analyzed_at).toLocaleString()}
      </p>
    </div>

    <div className="rounded-xl bg-gray-50 p-5">
      <p className="text-gray-500 text-sm">
        Pages
      </p>

      <p className="mt-2 text-lg font-semibold">
        {report.summary.total_pages}
      </p>
    </div>

    <div className="rounded-xl bg-gray-50 p-5">
      <p className="text-gray-500 text-sm">
        Total Clauses
      </p>

      <p className="mt-2 text-lg font-semibold">
        {report.summary.total_clauses}
      </p>
    </div>

  </div>

</section>

{/* ========================================= */}
{/* AI CONCLUSION */}
{/* ========================================= */}

<section className="mt-8 mb-10 rounded-3xl border bg-white p-8 shadow-sm">

  <div className="flex items-center gap-3">

    <FileText className="h-6 w-6 text-blue-600" />

    <h2 className="text-2xl font-bold">
      AI Conclusion
    </h2>

  </div>

  <div className="mt-6 rounded-2xl bg-blue-50 border border-blue-100 p-6">

    <p className="leading-8 text-gray-700">

      The AI analyzed

      <span className="font-bold">
        {" "}
        {report.summary.total_clauses} clauses
      </span>

      {" "}across{" "}

      <span className="font-bold">
        {report.summary.total_pages} pages
      </span>

      . It identified

      <span className="font-bold text-red-600">
        {" "}
        {report.summary.high_risk_count} high-risk
      </span>

      ,

      <span className="font-bold text-yellow-600">
        {" "}
        {report.summary.medium_risk_count} medium-risk
      </span>

      {" "}and

      <span className="font-bold text-green-600">
        {" "}
        {report.summary.safe_count} safe clauses
      </span>

      . The document has an overall risk score of

      <span className="font-bold">
        {" "}
        {report.summary.overall_risk_score}/100
      </span>

      {" "}and contains

      <span className="font-bold">
        {" "}
        {report.summary.negotiable_count}
      </span>

      {" "}clauses that may be negotiated before signing.

    </p>

  </div>

</section>


      
          </>
        )}

      </div>   {/* max-w-7xl */}
    </div>     {/* min-h-screen */}
  </DashboardLayout>
);

}