"use client";

import { UploadCloud } from "lucide-react";

export default function UploadDropzone() {
  return (
    <div className="mb-8 rounded-3xl border-2 border-dashed border-gray-300 bg-white p-16 shadow-sm transition hover:border-black">
      <div className="flex flex-col items-center justify-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-gray-300">
          <UploadCloud className="h-10 w-10 text-blue-600" />
        </div>

        <h2 className="text-2xl font-semibold">
          Drop your contract here
        </h2>

        <p className="mt-2 text-gray-500">
          or{" "}
          <button className="font-semibold text-blue-600 hover:underline">
            browse
          </button>
        </p>

        <p className="mt-4 text-sm text-gray-400">
          Supports PDF and DOCX up to 20 MB
        </p>
      </div>
    </div>
  );
}