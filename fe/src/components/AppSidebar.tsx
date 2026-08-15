"use client";

import { ClipboardList, User } from "lucide-react";

export type Workspace = "editor" | "patients";

interface AppSidebarProps {
  workspace: Workspace;
  onOpenEditor: () => void;
  onOpenPatients: () => void;
}

export function AppSidebar({
  workspace,
  onOpenEditor,
  onOpenPatients,
}: AppSidebarProps) {
  return (
    <aside className="w-16 md:w-52 shrink-0 border-r border-slate-800 bg-slate-950 p-2 md:p-3">
      <nav className="space-y-2">
        <button
          onClick={onOpenEditor}
          className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
            workspace === "editor"
              ? "bg-emerald-500 text-slate-950"
              : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          }`}
          title="Document Editor"
        >
          <ClipboardList className="w-5 h-5 shrink-0" />
          <span className="hidden md:inline">Document Editor</span>
        </button>
        <button
          onClick={onOpenPatients}
          className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
            workspace === "patients"
              ? "bg-emerald-500 text-slate-950"
              : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          }`}
          title="Patient Management"
        >
          <User className="w-5 h-5 shrink-0" />
          <span className="hidden md:inline">Patients</span>
        </button>
      </nav>
    </aside>
  );
}
