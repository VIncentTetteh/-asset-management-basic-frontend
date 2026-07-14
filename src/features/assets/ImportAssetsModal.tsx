"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Loader2, Upload } from "lucide-react";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";
import type { AssetImportResult } from "@/types";
import { importJobService } from "@/services/importJobService";
import { qk } from "@/lib/queryClient";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const EXPECTED_COLUMNS = [
  "1 · name *", "2 · assetTag", "3 · serialNumber", "4 · description",
  "5 · assetType", "6 · manufacturer", "7 · model", "8 · purchaseDate",
  "9 · purchaseCost", "10 · currency", "11 · depreciationMethod", "12 · usefulLifeMonths",
  "13 · residualValue", "14 · warrantyExpiryDate", "15 · status", "16 · condition",
  "17 · categoryName", "18 · locationName", "19 · supplierName", "20 · departmentName",
  "21 · assignedUserEmail", "22 · invoiceId", "23 · insurancePolicyId",
];

export function ImportAssetsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<AssetImportResult | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFile(null);
      setResult(null);
      setJobId(null);
      setStatus(null);
    }
  }, [isOpen]);

  // Poll background import jobs until they settle.
  useEffect(() => {
    if (!jobId || !(status === "PENDING" || status === "PROCESSING" || status === "uploading")) return;

    const interval = setInterval(async () => {
      try {
        const details = await importJobService.getJobDetails(jobId);
        setStatus(details.status || "COMPLETED");

        if (details.status === "COMPLETED" || details.status === "FAILED") {
          if (details.result) {
            setResult({
              totalRows: details.result.totalRows || 0,
              imported: details.result.imported || 0,
              skipped: details.result.skipped || 0,
              errors: (details.result.errors || []).map((e) => ({ row: e.row || 0, message: e.message || "" })),
            });
          }
          if (details.status === "COMPLETED") {
            toast.success("Bulk import completed");
            queryClient.invalidateQueries({ queryKey: qk.assets.all });
          }
          setJobId(null);
        }
      } catch (err) {
        console.error("Import polling failed", err);
        clearInterval(interval);
        setJobId(null);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [jobId, status, queryClient]);

  const handleImport = async () => {
    if (!file) return;
    setIsImporting(true);
    setResult(null);
    setJobId(null);
    setStatus("uploading");

    try {
      const response = await importJobService.importAssets(file);
      if (response.jobId) {
        setJobId(response.jobId);
        setStatus(response.status || "PENDING");
        toast.success("File uploaded — processing in the background");
      } else if (response.result) {
        setResult({
          totalRows: response.result.totalRows || 0,
          imported: response.result.imported || 0,
          skipped: response.result.skipped || 0,
          errors: (response.result.errors || []).map((e) => ({ row: e.row || 0, message: e.message || "" })),
        });
        toast.success("Assets imported");
        queryClient.invalidateQueries({ queryKey: qk.assets.all });
      }
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to start import";
      toast.error(message);
      setStatus("FAILED");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Import assets from Excel"
      description="Upload an .xlsx file to bulk-import assets. Bad rows are skipped and reported without aborting the batch."
    >
      <div className="space-y-5">
        <details className="rounded-card border border-edge bg-surface-muted text-xs">
          <summary className="ea-focus cursor-pointer select-none rounded-sm px-3 py-2 font-semibold text-muted-fg">
            Expected column order (row 1 = header)
          </summary>
          <div className="space-y-3 px-3 pb-3 pt-2">
            <div className="data-mono grid grid-cols-2 gap-x-6 gap-y-0.5 text-muted-fg">
              {EXPECTED_COLUMNS.map((col) => <span key={col}>{col}</span>)}
            </div>
            <div className="space-y-1 border-t border-edge-subtle pt-2 text-[10px] text-faint-fg">
              <p><span className="font-semibold text-muted-fg">categoryName / locationName / supplierName</span> — exact names as created in your org</p>
              <p><span className="font-semibold text-muted-fg">departmentName</span> — department name <em>or</em> department code</p>
              <p><span className="font-semibold text-muted-fg">assignedUserEmail</span> — user email <em>or</em> employee number</p>
            </div>
          </div>
        </details>

        <div className="space-y-2">
          <Label htmlFor="importFile">Excel file (.xlsx)</Label>
          <Input
            id="importFile"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setResult(null);
            }}
          />
        </div>

        {jobId && (
          <div className="flex flex-col items-center justify-center rounded-panel border border-edge bg-surface-muted p-8">
            <Loader2 className="mb-3 h-9 w-9 animate-spin text-brand" />
            <p className="text-sm font-bold text-foreground">Status: {status?.replace(/_/g, " ")}</p>
            <p className="mt-1 text-xs text-muted-fg">Processing your file on the server. This may take a moment…</p>
          </div>
        )}

        {result && !jobId && (
          <div className="space-y-3 rounded-card border border-edge bg-surface p-4 text-sm">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-card border border-edge-subtle bg-surface-muted py-2">
                <p className="text-xs uppercase tracking-wide text-faint-fg">Total rows</p>
                <p className="data-mono text-xl font-bold text-foreground">{result.totalRows}</p>
              </div>
              <div className="rounded-card border border-edge-subtle bg-ok-soft py-2">
                <p className="flex items-center justify-center gap-1 text-xs uppercase tracking-wide text-ok">
                  <CheckCircle2 className="h-3 w-3" />Imported
                </p>
                <p className="data-mono text-xl font-bold text-ok">{result.imported}</p>
              </div>
              <div className="rounded-card border border-edge-subtle bg-warn-soft py-2">
                <p className="flex items-center justify-center gap-1 text-xs uppercase tracking-wide text-warn">
                  <AlertTriangle className="h-3 w-3" />Skipped
                </p>
                <p className="data-mono text-xl font-bold text-warn">{result.skipped}</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="max-h-48 space-y-1.5 overflow-y-auto">
                <p className="flex items-center gap-1 text-xs font-semibold text-danger">
                  <XCircle className="h-3.5 w-3.5" /> Row errors
                </p>
                {result.errors.map((e, i) => (
                  <div key={i} className="flex gap-2 rounded-control border border-edge-subtle bg-danger-soft px-2.5 py-1.5 text-xs">
                    <span className="data-mono shrink-0 font-bold text-danger">Row {e.row}</span>
                    <span className="text-foreground">{e.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-edge-subtle pt-3">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={handleImport} disabled={!file || isImporting}>
            {isImporting
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importing…</>
              : <><Upload className="mr-2 h-4 w-4" />Import</>}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
