"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Download, Eye, LoaderCircle, X } from "lucide-react";
import {
  buildPdfQualityVariants,
  DEFAULT_PDF_QUALITY,
  formatPdfSize,
  PDF_QUALITY_PRESETS,
  type PdfPageToRender,
  type PdfQuality,
  type PdfQualityResults,
} from "../lib/pdf-export";

interface PdfExportDialogProps {
  getPages: () => PdfPageToRender[];
  fileName: string;
  onClose: () => void;
  onPreview: (preview: { url: string; fileName: string }) => void;
  serialize?: (pdf: import("jspdf").jsPDF) => Blob;
  allowSeparate?: boolean;
  initialAction?: "preview" | "download";
  children?: ReactNode;
}

export function PdfExportDialog({ getPages, fileName, onClose, onPreview, serialize, allowSeparate = false, initialAction = "download", children }: PdfExportDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [quality, setQuality] = useState<PdfQuality>(DEFAULT_PDF_QUALITY);
  const [separate, setSeparate] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // Associate results with their source so changed pages can never download stale PDFs.
  const [prepared, setPrepared] = useState<{ getPages: typeof getPages; separate: boolean; results: PdfQualityResults } | null>(null);
  const [status, setStatus] = useState("Preparing quality options…");
  const [error, setError] = useState("");
  const results = prepared?.getPages === getPages && prepared.separate === separate ? prepared.results : null;

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    // Defer expensive capture so the dialog paints first and Strict Mode can clean up.
    const timer = setTimeout(() => {
      setError("");
      setPrepared(null);
      setStatus("Preparing quality options…");
      void Promise.resolve().then(() => buildPdfQualityVariants(getPages(), {
        separate,
        serialize,
        signal: controller.signal,
        onProgress: (page, total) => {
          if (!controller.signal.aborted) setStatus(`Preparing page ${page} of ${total}…`);
        },
      })).then((variants) => {
        if (!controller.signal.aborted) setPrepared({ getPages, separate, results: variants });
      }).catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Unable to prepare the PDF. Please try again.");
      });
    }, 100);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [getPages, separate, serialize, attempt]);

  const download = () => {
    if (!results) return;
    for (const [index, file] of results[quality].files.entries()) {
      const url = URL.createObjectURL(file.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = separate ? `${fileName.replace(/\.pdf$/i, "")}_${index + 1}.pdf` : fileName;
      (dialog.current ?? document.body).appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }
    onClose();
  };

  const preview = () => {
    if (!results) return;
    const file = results[quality].files[0];
    onClose();
    onPreview({ url: URL.createObjectURL(file.blob), fileName: separate ? `${fileName.replace(/\.pdf$/i, "")}_1.pdf` : fileName });
  };

  return (
    <dialog ref={dialog} aria-labelledby="pdf-export-title" onCancel={onClose} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950 p-0 text-slate-100 shadow-2xl backdrop:bg-black/70">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-950 px-5 py-4">
        <div>
          <h2 id="pdf-export-title" className="flex items-center gap-2 text-lg font-bold"><Download className="h-5 w-5 text-emerald-400" />PDF Export Settings</h2>
          <p className="mt-1 text-xs text-slate-400">Choose quality and compare file sizes before saving.</p>
        </div>
        <button type="button" aria-label="Close export settings" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><X className="h-5 w-5" /></button>
      </div>
      <div className="space-y-5 p-5">
        {children}
        {allowSeparate && (
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-semibold">Save mode</legend>
            <label className="flex items-center gap-2 text-sm text-slate-300"><input type="radio" name="pdf-save-mode" checked={!separate} onChange={() => setSeparate(false)} className="accent-emerald-400" />Combined — all pages in one PDF</label>
            <label className="flex items-center gap-2 text-sm text-slate-300"><input type="radio" name="pdf-save-mode" checked={separate} onChange={() => setSeparate(true)} className="accent-emerald-400" />Separate — one PDF per page</label>
          </fieldset>
        )}
        <fieldset className="space-y-2">
          <legend className="mb-3 flex w-full items-center justify-between text-sm font-semibold"><span>Export quality</span><span className="text-xs font-normal text-slate-400">{separate ? "Total file size" : "File size"}</span></legend>
          {PDF_QUALITY_PRESETS.map((preset) => (
            <label key={preset.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 transition-colors ${quality === preset.id ? "border-emerald-400/70 bg-emerald-400/10" : "border-slate-800 hover:border-slate-600"}`}>
              <input type="radio" name="pdf-quality" value={preset.id} checked={quality === preset.id} onChange={() => setQuality(preset.id)} autoFocus={preset.id === DEFAULT_PDF_QUALITY} className="shrink-0 accent-emerald-400" />
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{preset.label}{preset.id === DEFAULT_PDF_QUALITY && <span className="ml-2 text-[10px] font-normal text-emerald-300">Default</span>}</span><span className="mt-0.5 block text-xs text-slate-400">{preset.description}</span></span>
              <span className="shrink-0 text-right text-xs tabular-nums text-slate-300">{results ? formatPdfSize(results[preset.id].size) : error ? "Unavailable" : "Calculating…"}</span>
            </label>
          ))}
        </fieldset>
        <div aria-live="polite" className="text-xs text-slate-400">
          {error ? <div role="alert" className="text-red-300">{error}<button type="button" onClick={() => setAttempt((value) => value + 1)} className="ml-2 underline">Retry</button></div> : results ? "Sizes are calculated from the actual PDFs. Higher quality may produce larger files." : <span className="flex items-center gap-2"><LoaderCircle className="h-3.5 w-3.5 animate-spin" />{status}</span>}
          {separate && <p className="mt-2">Preview shows the first selected page. Download saves every selected page as a separate file.</p>}
          <p className="mt-2">Text and codes stay sharp at every quality. Quality options control images and artwork.</p>
        </div>
      </div>
      <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-slate-800 bg-slate-950 px-5 py-4">
        <button type="button" onClick={onClose} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold hover:bg-slate-700">Cancel</button>
        <button type="button" onClick={preview} disabled={!results} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-40 ${initialAction === "preview" ? "bg-sky-500 text-slate-950 hover:bg-sky-400" : "border border-slate-700 hover:bg-slate-800"}`}><Eye className="h-4 w-4" />Preview PDF</button>
        <button type="button" onClick={download} disabled={!results} className="flex items-center gap-2 rounded-lg bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-300 disabled:opacity-40"><Download className="h-4 w-4" />Download PDF</button>
      </div>
    </dialog>
  );
}
