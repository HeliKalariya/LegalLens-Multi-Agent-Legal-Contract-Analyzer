import {
  FileText,
  CheckCircle2,
  X,
} from "lucide-react";

const uploads = [
  {
    name: "Acme_MSA_v3.pdf",
    size: "1.2 MB",
    progress: 100,
  },
  {
    name: "NDA_Vendor_Q3.docx",
    size: "480 KB",
    progress: 100,
  },
  {
    name: "Supplier_Agreement.pdf",
    size: "2.8 MB",
    progress: 100,
  },
];

export default function RecentUploads() {
  return (
    <div className="rounded-3xl border bg-white shadow-sm">
      <div className="border-b p-6">
        <h2 className="text-xl font-semibold">
          Recent uploads
        </h2>
      </div>

      <div>
        {uploads.map((file) => (
          <div
            key={file.name}
            className="flex items-center gap-5 border-b p-6 last:border-none"
          >
            {/* Icon */}

            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
              <FileText className="text-blue-600" />
            </div>

            {/* Details */}

            <div className="flex-1">
              <div className="flex justify-between">
                <h3 className="font-medium">
                  {file.name}
                </h3>

                <span className="text-sm text-gray-500">
                  {file.size}
                </span>
              </div>

              <div className="mt-3 h-2 rounded-full bg-gray-200">
                <div
                  className="h-2 rounded-full bg-black"
                  style={{
                    width: `${file.progress}%`,
                  }}
                />
              </div>
            </div>

            <CheckCircle2 className="text-green-500" />

            <button>
              <X
                className="text-gray-400 hover:text-red-500"
                size={18}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}