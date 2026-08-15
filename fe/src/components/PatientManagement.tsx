"use client";

import type { PatientListItem } from "../types/report";

interface PatientManagementProps {
  patients: PatientListItem[];
  search: string;
  isLoading: boolean;
  deletingPatientId: string | null;
  onSearchChange: (search: string) => void;
  onRefresh: () => void;
  onCreatePatient: () => void;
  onOpenPatient: (patientId: string) => void;
  onDeletePatient: (patientId: string) => void;
}

export function PatientManagement({
  patients,
  search,
  isLoading,
  deletingPatientId,
  onSearchChange,
  onRefresh,
  onCreatePatient,
  onOpenPatient,
  onDeletePatient,
}: PatientManagementProps) {
  const searchTerm = search.trim().toLowerCase();
  const visiblePatients = patients.filter((patient) =>
    [patient.patientName, patient.uhid, patient.hospitalDetails?.hospitalName]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(searchTerm)),
  );

  return (
    <section className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-900/50">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-100">Patient Management</h2>
            <p className="text-sm text-slate-400 mt-1">
              Open a patient to auto-fill the report editor, or manage saved records.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="px-3 py-2 text-sm font-semibold rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 disabled:opacity-50"
            >
              {isLoading ? "Loading..." : "Refresh"}
            </button>
            <button
              onClick={onCreatePatient}
              className="px-3 py-2 text-sm font-bold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950"
            >
              New Patient
            </button>
          </div>
        </div>

        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search by patient name, UHID, or hospital"
          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
        />

        <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
          {isLoading ? (
            <p className="p-6 text-sm text-slate-400">Loading patients...</p>
          ) : visiblePatients.length === 0 ? (
            <p className="p-6 text-sm text-slate-400">No patient records found.</p>
          ) : (
            <div className="divide-y divide-slate-800">
              {visiblePatients.map((patient) => (
                <div
                  key={patient._id}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-100 truncate">
                      {patient.patientName || "Unnamed patient"}
                    </p>
                    <p className="text-xs text-emerald-400 mt-1">UHID: {patient.uhid}</p>
                    <p className="text-xs text-slate-400 mt-1 truncate">
                      {patient.hospitalDetails?.hospitalName || "Hospital details not available"}
                      {patient.updatedAt && ` · Updated ${new Date(patient.updatedAt).toLocaleString()}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => onOpenPatient(patient._id)}
                      className="px-3 py-2 text-sm font-semibold rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950"
                    >
                      Open & Edit
                    </button>
                    <button
                      onClick={() => onDeletePatient(patient._id)}
                      disabled={deletingPatientId === patient._id}
                      className="px-3 py-2 text-sm font-semibold rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-300 disabled:opacity-50"
                    >
                      {deletingPatientId === patient._id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
