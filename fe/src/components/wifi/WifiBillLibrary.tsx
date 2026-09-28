"use client";

import { useEffect, useState } from "react";
import { FolderOpen, LoaderCircle, Plus, RefreshCw } from "lucide-react";
import { getWifiCustomer, listWifiCustomers, type WifiCustomer, type WifiCustomerSummary, type WifiSavedBillSummary } from "../../lib/wifi-api";
import { formatBillMonth } from "../../lib/wifi-bill";

interface Props {
  customerId: string | null;
  billId: string | null;
  revision: number;
  disabled: boolean;
  onOpenBill: (id: string) => void;
  onNewBill: (customer: WifiCustomer) => void;
}

export function WifiBillLibrary({ customerId, billId, revision, disabled, onOpenBill, onNewBill }: Props) {
  const [customers, setCustomers] = useState<WifiCustomerSummary[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(customerId || "");
  const [customer, setCustomer] = useState<WifiCustomer | null>(null);
  const [bills, setBills] = useState<WifiSavedBillSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([
      listWifiCustomers(),
      selectedCustomerId ? getWifiCustomer(selectedCustomerId) : Promise.resolve(null),
    ]).then(([list, details]) => {
      if (!active) return;
      setCustomers(list.customers);
      setCustomer(details?.customer || null);
      setBills(details?.bills || []);
    }).catch((cause: unknown) => {
      if (active) { setCustomer(null); setBills([]); setError(cause instanceof Error ? cause.message : "Unable to load saved bills."); }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selectedCustomerId, revision, refresh]);

  return <details className="border-b border-slate-800 bg-slate-950/30" open>
    <summary className="cursor-pointer px-5 py-4 text-sm font-semibold">Saved customers &amp; bills</summary>
    <div className="space-y-3 px-5 pb-5">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor="wifi-saved-customer" className="mb-1.5 block text-xs text-slate-400">Customer</label>
          <select id="wifi-saved-customer" value={selectedCustomerId} disabled={disabled || loading} onChange={(event) => { setLoading(true); setError(""); setSelectedCustomerId(event.target.value); }} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-sm text-slate-100 disabled:opacity-50">
            <option value="">Choose a saved customer</option>
            {customers.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}{entry.accountNumber ? ` · ${entry.accountNumber}` : ""}</option>)}
          </select>
        </div>
        <button type="button" disabled={loading || disabled} aria-label="Refresh saved customers" onClick={() => { setLoading(true); setError(""); setRefresh((value) => value + 1); }} className="rounded-lg border border-slate-700 p-2.5 text-slate-300 disabled:opacity-50">{loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}</button>
      </div>
      {error && <p role="alert" className="text-xs text-amber-300">{error}</p>}
      {!loading && !error && customers.length === 0 && <p className="text-xs text-slate-400">Save a draft to add your first customer.</p>}
      {customer && !loading && <>
        <button type="button" disabled={disabled} onClick={() => onNewBill(customer)} className="flex items-center gap-2 text-xs font-semibold text-sky-300 disabled:opacity-50"><Plus className="h-4 w-4" />New bill for {customer.name}</button>
        <ul className="max-h-48 space-y-2 overflow-auto" aria-label="Saved bills">
          {bills.map((bill) => <li key={bill.id}>
            <button type="button" disabled={disabled} onClick={() => onOpenBill(bill.id)} aria-current={billId === bill.id ? "true" : undefined} className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left disabled:opacity-50 ${billId === bill.id ? "border-sky-500/40 bg-sky-500/10" : "border-slate-800 hover:bg-slate-800/60"}`}>
              <FolderOpen className="h-4 w-4 shrink-0 text-sky-400" />
              <span className="min-w-0"><strong className="block truncate text-xs">{bill.invoiceNumber || "Untitled draft"}</strong><span className="text-xs text-slate-400">{formatBillMonth(bill.billMonth)}</span></span>
              {billId === bill.id && <span className="ml-auto text-[10px] text-sky-300">Open</span>}
            </button>
          </li>)}
        </ul>
        {bills.length === 0 && <p className="text-xs text-slate-400">No saved bills for this customer yet.</p>}
      </>}
    </div>
  </details>;
}
