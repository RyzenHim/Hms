"use client";

import Link from "next/link";
import { Building2, ChevronLeft, ChevronRight, ClipboardList, LayoutGrid, User, Wifi } from "lucide-react";

export type Workspace = "editor" | "patients" | "wifi";

interface AppSidebarProps {
  workspace: Workspace;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  onOpenEditor?: () => void;
  onOpenPatients?: () => void;
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
      <nav aria-label="Applications" className="space-y-2">
        <Link href="/" title="All applications" aria-label="All applications" className={`flex items-center rounded-lg py-2.5 text-sm font-semibold text-slate-400 hover:bg-slate-800 hover:text-slate-100 ${isCollapsed ? "justify-center px-2" : "gap-3 px-3"}`}>
          <LayoutGrid className="h-5 w-5 shrink-0" />
          {!isCollapsed && <span>All applications</span>}
        </Link>
        {!isCollapsed && <p className="px-3 pb-1 pt-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Workspaces</p>}
        <Link href="/wifi" title="WiFi Bill Generator" aria-label="WiFi Bill Generator" aria-current={workspace === "wifi" ? "page" : undefined} className={`flex items-center rounded-lg py-2.5 text-sm font-semibold ${isCollapsed ? "justify-center px-2" : "gap-3 px-3"} ${workspace === "wifi" ? "bg-sky-500 text-slate-950" : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"}`}>
          <Wifi className="h-5 w-5 shrink-0" />
          {!isCollapsed && <span>WiFi Bill Generator</span>}
        </Link>
        <Link href="/hms" title="HMS" aria-label="HMS" aria-current={workspace !== "wifi" ? "page" : undefined} className={`flex items-center rounded-lg py-2.5 text-sm font-semibold ${isCollapsed ? "justify-center px-2" : "gap-3 px-3"} ${workspace !== "wifi" ? "bg-emerald-500/15 text-emerald-400" : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"}`}>
          <Building2 className="h-5 w-5 shrink-0" />
          {!isCollapsed && <span>HMS</span>}
        </Link>
      </nav>
      {workspace !== "wifi" && <nav aria-label="HMS tools" className="mt-4 space-y-2 border-t border-slate-800 pt-4">
        <button
          onClick={onOpenEditor}
          className={`w-full flex items-center ${isCollapsed ? "justify-center px-2" : "gap-3 px-3"} rounded-lg py-2.5 text-sm font-semibold transition-colors ${
            workspace === "editor"
              ? "bg-emerald-500 text-slate-950"
              : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          }`}
          title="Document Editor"
          aria-label="Document Editor"
          aria-current={workspace === "editor" ? "page" : undefined}
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
          aria-label="Patient Management"
          aria-current={workspace === "patients" ? "page" : undefined}
        >
          <User className="w-5 h-5 shrink-0" />
          {!isCollapsed && <span>Patients</span>}
        </button>
      </nav>}
    </aside>
  );
}
