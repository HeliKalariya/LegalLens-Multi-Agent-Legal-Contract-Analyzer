"use client";

import { ChangeEvent, DragEvent, useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { API_URL, authenticatedFetch } from "@/lib/api";

type UploadDropzoneProps = {
  onUploaded: (documentId: string) => void;
};

function shortenedFilename(filename: string, maxLength = 42) {
  return filename.length > maxLength ? `${filename.slice(0, maxLength - 3)}...` : filename;
}

export default function UploadDropzone({ onUploaded }: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  async function uploadFile(file: File) {
    const filename = file.name.toLowerCase();
    const isPdf = file.type === "application/pdf" || filename.endsWith(".pdf");
    const isDocx = file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || filename.endsWith(".docx");
    if (!isPdf && !isDocx) {
      setMessage("Please choose a PDF or DOCX legal document.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setMessage("Documents must be 20 MB or smaller.");
      return;
    }

    setIsUploading(true);
    setMessage("");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await authenticatedFetch(`${API_URL}/api/upload/`, {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail ?? "Upload failed.");

      setMessage(`${shortenedFilename(result.data.original_filename)} saved successfully.`);
      toast.success("Legal document saved successfully.");
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
      className="mb-6 rounded-2xl border-2 border-dashed border-gray-300 bg-[#EAE6DB] p-8 shadow-sm transition hover:border-black sm:mb-8 sm:rounded-3xl sm:p-16"
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <div className="flex flex-col items-center justify-center text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-gray-300 sm:mb-6 sm:h-20 sm:w-20">
          <UploadCloud className="h-8 w-8 text-blue-600 sm:h-10 sm:w-10" />
        </div>
        <h2 className="text-xl font-semibold sm:text-2xl">Drop your legal document here</h2>
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
        <input ref={inputRef} type="file" accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx" className="hidden" onChange={handleFileInput} />
        <p className="mt-4 text-sm text-gray-400">PDF or DOCX files up to 20 MB</p>
        {message && <p className="mt-4 text-sm text-gray-700" role="status">{message}</p>}
        {isUploading && <p className="mt-4 text-sm text-blue-600">Saving PDF…</p>}
      </div>
    </div>
  );
}
