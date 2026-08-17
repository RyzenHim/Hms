"use client";

import { ChevronLeft, ChevronRight, ClipboardList, User } from "lucide-react";

export type Workspace = "editor" | "patients";

interface AppSidebarProps {
  workspace: Workspace;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  onOpenEditor: () => void;
  onOpenPatients: () => void;
}

export function AppSidebar({
  workspace,
  isCollapsed,
  onToggleCollapsed,
  onOpenEditor,
  onOpenPatients,
}: AppSidebarProps) {
  return (
    <aside
      className={`${isCollapsed ? "w-16" : "w-52"} shrink-0 border-r border-slate-800 bg-slate-950 p-2 transition-[width] duration-200`}
    >
      <div className={`flex mb-3 ${isCollapsed ? "justify-center" : "justify-end"}`}>
        <button
          onClick={onToggleCollapsed}
          className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>
      <nav className="space-y-2">
        <button
          onClick={onOpenEditor}
          className={`w-full flex items-center ${isCollapsed ? "justify-center px-2" : "gap-3 px-3"} rounded-lg py-2.5 text-sm font-semibold transition-colors ${
            workspace === "editor"
              ? "bg-emerald-500 text-slate-950"
              : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          }`}
          title="Document Editor"
        >
          <ClipboardList className="w-5 h-5 shrink-0" />
          {!isCollapsed && <span>Document Editor</span>}
        </button>
        <button
          onClick={onOpenPatients}
          className={`w-full flex items-center ${isCollapsed ? "justify-center px-2" : "gap-3 px-3"} rounded-lg py-2.5 text-sm font-semibold transition-colors ${
            workspace === "patients"
              ? "bg-emerald-500 text-slate-950"
              : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          }`}
          title="Patient Management"
        >
          <User className="w-5 h-5 shrink-0" />
          {!isCollapsed && <span>Patients</span>}
        </button>
      </nav>
    </aside>
  );
}
