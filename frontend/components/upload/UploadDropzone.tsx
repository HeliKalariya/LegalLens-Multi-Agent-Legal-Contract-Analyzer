"use client";

import { ChangeEvent, DragEvent, useRef, useState } from "react";
import { UploadCloud } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

type UploadDropzoneProps = {
  onUploaded: (documentId: string) => void;
};

export default function UploadDropzone({ onUploaded }: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  async function uploadFile(file: File) {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setMessage("Please choose a PDF file.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setMessage("PDFs must be 20 MB or smaller.");
      return;
    }

    setIsUploading(true);
    setMessage("");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${API_URL}/api/upload/`, {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail ?? "Upload failed.");

      setMessage(`${result.data.original_filename} saved successfully.`);
      onUploaded(result.data.document_id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void uploadFile(file);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) void uploadFile(file);
  }

  return (
    <div
      className="mb-8 rounded-3xl border-2 border-dashed border-gray-300 bg-white p-16 shadow-sm transition hover:border-black"
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <div className="flex flex-col items-center justify-center text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-gray-300">
          <UploadCloud className="h-10 w-10 text-blue-600" />
        </div>
        <h2 className="text-2xl font-semibold">Drop your PDF here</h2>
        <p className="mt-2 text-gray-500">
          or{" "}
          <button
            type="button"
            className="font-semibold text-blue-600 hover:underline"
            onClick={() => inputRef.current?.click()}
          >
            browse
          </button>
        </p>
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={handleFileInput} />
        <p className="mt-4 text-sm text-gray-400">PDF files up to 20 MB</p>
        {message && <p className="mt-4 text-sm text-gray-700" role="status">{message}</p>}
        {isUploading && <p className="mt-4 text-sm text-blue-600">Saving PDF…</p>}
      </div>
    </div>
  );
}
