"use client";

import { Download, Maximize2, Minimize2, X } from "lucide-react";
import { useState } from "react";

interface PdfPreviewModalProps {
  url: string;
  fileName: string;
  onClose: () => void;
}

export function PdfPreviewModal({
  url,
  fileName,
  onClose,
}: PdfPreviewModalProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  return (
    <div
      className={`fixed inset-0 z-[100] flex bg-black/80 ${isFullscreen ? "p-0" : "p-4"}`}
    >
      <div
        className={`m-auto flex w-full flex-col overflow-hidden border border-slate-700 bg-slate-950 shadow-2xl ${
          isFullscreen
            ? "h-full max-w-none rounded-none"
            : "h-[92vh] max-w-6xl rounded-xl"
        }`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
          <div>
            <h3 className="text-sm font-bold text-slate-100">PDF Preview</h3>
            <p className="text-[10px] text-slate-500">
              This is the same optimized PDF used for download.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={url}
              download={fileName}
              className="flex items-center gap-1.5 rounded bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400"
            >
              <Download className="h-4 w-4" />
              Download
            </a>
            <button
              type="button"
              onClick={() => setIsFullscreen((current) => !current)}
              className="rounded bg-slate-800 p-2 text-slate-200 hover:bg-slate-700"
              title={isFullscreen ? "Exit full screen" : "Full screen"}
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded bg-slate-800 p-2 text-slate-200 hover:bg-red-500/30 hover:text-red-300"
              title="Close preview"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <iframe
          src={`${url}#view=FitH&toolbar=1&navpanes=0`}
          title="Generated PDF preview"
          className="min-h-0 flex-1 bg-slate-800"
        />
      </div>
    </div>
  );
}
