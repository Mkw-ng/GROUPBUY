import { useMemo, useRef, useState } from "react";
import { Download, FileArchive, FileSpreadsheet, ShieldCheck, Upload } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";

type CatalogAction = "create" | "update" | "delete";
type CatalogChange = {
  action: CatalogAction;
  item: string;
  file: string;
  row: number;
  field: string;
  oldValue: string | number | boolean | null;
  newValue: string | number | boolean | null;
};
type CatalogIssue = { file: string; row: number; message: string };
type CatalogPreview = {
  creates: number;
  updates: number;
  deletes: number;
  unchanged: number;
  conflicts: CatalogIssue[];
  errors: CatalogIssue[];
  warnings: string[];
  blockers: string[];
  changes: CatalogChange[];
  operations: Array<{ kind: string; target: string }>;
  safety: { visibleAvailableBefore: number; visibleAvailableAfter: number };
  planHash: string;
};
type ApplyCounts = { creates: number; updates: number; deletes: number };

interface CatalogCsvDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function printable(value: string | number | boolean | null): string {
  if (value === null) return "(blank)";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return String(value) || "(blank)";
}

function isPreview(value: unknown): value is CatalogPreview {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CatalogPreview>;
  return typeof candidate.planHash === "string"
    && Array.isArray(candidate.operations)
    && Array.isArray(candidate.changes)
    && Array.isArray(candidate.errors)
    && Array.isArray(candidate.conflicts)
    && Array.isArray(candidate.warnings)
    && Array.isArray(candidate.blockers)
    && typeof candidate.creates === "number"
    && typeof candidate.updates === "number"
    && typeof candidate.deletes === "number"
    && typeof candidate.unchanged === "number"
    && Boolean(candidate.safety)
    && typeof candidate.safety?.visibleAvailableBefore === "number"
    && typeof candidate.safety?.visibleAvailableAfter === "number";
}

function isApplyCounts(value: unknown): value is ApplyCounts {
  return Boolean(value) && typeof value === "object"
    && typeof (value as Partial<ApplyCounts>).creates === "number"
    && typeof (value as Partial<ApplyCounts>).updates === "number"
    && typeof (value as Partial<ApplyCounts>).deletes === "number";
}

function errorMessage(value: unknown, fallback: string): string {
  return value && typeof value === "object" && "error" in value && typeof value.error === "string" ? value.error : fallback;
}

function backupFilename(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Melbourne", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? "00";
  return `catalog-backup-${part("year")}-${part("month")}-${part("day")}-${part("hour")}${part("minute")}.zip`;
}

function Count({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "danger" | "warning" }) {
  const colors = tone === "danger" ? "border-red-300 bg-red-50 text-red-800" : tone === "warning" ? "border-amber-300 bg-amber-50 text-amber-800" : "border-border bg-muted/40 text-foreground";
  return <div className={`border px-3 py-2 ${colors}`}><p className="font-mono text-lg font-bold tabular-nums">{value}</p><p className="text-[10px] uppercase tracking-wider">{label}</p></div>;
}

function actionClass(action: CatalogAction): string {
  if (action === "delete") return "text-red-700";
  if (action === "create") return "text-emerald-700";
  return "text-amber-800";
}

/** Catalog download, preview, backup, and transactional apply experience. */
export default function CatalogCsvDialog({ open, onOpenChange }: CatalogCsvDialogProps) {
  const utils = trpc.useUtils();
  const [files, setFiles] = useState<File[]>([]);
  const [preview, setPreview] = useState<CatalogPreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isDownloadingBackup, setIsDownloadingBackup] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [restoreMode, setRestoreMode] = useState(false);
  const [backupTakenForHash, setBackupTakenForHash] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const requestInFlight = isPreviewing || isDownloadingBackup || isApplying;

  const displayChanges = useMemo(() => preview ? [...preview.changes].sort((left, right) => {
    const rank = (change: CatalogChange) => change.action === "delete" ? 0 : 1;
    return rank(left) - rank(right) || left.item.localeCompare(right.item) || left.field.localeCompare(right.field);
  }) : [], [preview]);
  const deletes = useMemo(() => preview?.changes.filter((change) => change.action === "delete") ?? [], [preview]);
  const overwrittenRows = useMemo(() => preview?.warnings.filter((warning) => warning.endsWith("(restore mode: overwriting)")).length ?? 0, [preview]);
  const requiresTypedConfirmation = Boolean(preview && (deletes.length > 0 || preview.operations.length > 50 || restoreMode));
  const applyBlockedByProblems = Boolean(preview && (preview.errors.length > 0 || preview.blockers.length > 0 || (!restoreMode && preview.conflicts.length > 0)));
  const tooManyOperations = Boolean(preview && preview.operations.length > 1000);
  const canApply = Boolean(preview && preview.operations.length >= 1 && preview.operations.length <= 1000 && !applyBlockedByProblems && backupTakenForHash === preview.planHash && !requestInFlight);

  const resetImport = () => {
    setFiles([]);
    setPreview(null);
    setMessage(null);
    setRestoreMode(false);
    setBackupTakenForHash(null);
    setConfirmOpen(false);
    setConfirmationText("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && requestInFlight) return;
    onOpenChange(nextOpen);
    if (!nextOpen) resetImport();
  };

  const downloadCatalog = (path: string) => {
    const link = document.createElement("a");
    link.href = path;
    link.download = "";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFiles = (selected: FileList | null) => {
    const selectedFiles = Array.from(selected ?? []);
    setPreview(null);
    setBackupTakenForHash(null);
    if (selectedFiles.length === 0) return;
    if (selectedFiles.some((file) => file.name.toLowerCase().endsWith(".zip"))) {
      setFiles([]); setMessage("Unzip first and choose the .csv files."); if (inputRef.current) inputRef.current.value = ""; return;
    }
    if (selectedFiles.length > 3 || selectedFiles.some((file) => !file.name.toLowerCase().endsWith(".csv"))) {
      setFiles([]); setMessage("Choose one to three .csv files."); if (inputRef.current) inputRef.current.value = ""; return;
    }
    if (selectedFiles.some((file) => file.size > 5 * 1024 * 1024)) {
      setFiles([]); setMessage("Each CSV file must be 5 MB or smaller."); if (inputRef.current) inputRef.current.value = ""; return;
    }
    setFiles(selectedFiles);
    setMessage(null);
  };

  const makeFormData = (currentPreview: CatalogPreview) => {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    formData.append("restoreMode", String(restoreMode));
    formData.append("planHash", currentPreview.planHash);
    return formData;
  };

  const previewChanges = async () => {
    if (files.length === 0 || requestInFlight) return;
    setIsPreviewing(true); setPreview(null); setBackupTakenForHash(null); setMessage(null);
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      formData.append("restoreMode", String(restoreMode));
      const response = await fetch("/api/admin/catalog/preview", { method: "POST", credentials: "include", body: formData });
      const body: unknown = await response.json().catch(() => ({ error: "Unable to read preview" }));
      if (!response.ok) throw new Error(errorMessage(body, "Unable to preview catalog changes"));
      if (!isPreview(body)) throw new Error("Unexpected preview response");
      setPreview(body);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Unable to preview catalog changes";
      setMessage(text); toast.error(text);
    } finally {
      setIsPreviewing(false);
    }
  };

  const downloadBackup = async () => {
    if (!preview || requestInFlight) return;
    setIsDownloadingBackup(true); setMessage(null);
    try {
      const response = await fetch("/api/admin/catalog/export", { credentials: "include" });
      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
      if (!response.ok || !contentType.includes("application/zip")) throw new Error("Unable to download catalog backup");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = backupFilename(); document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
      setBackupTakenForHash(preview.planHash);
      toast.success("Catalog backup downloaded");
    } catch (error) {
      const text = error instanceof Error ? error.message : "Unable to download catalog backup";
      setMessage(text); toast.error(text);
    } finally {
      setIsDownloadingBackup(false);
    }
  };

  const invalidateCatalogQueries = async () => {
    await Promise.all([utils.products.list.invalidate(), utils.categories.list.invalidate(), utils.sections.list.invalidate()]);
  };

  const applyChanges = async () => {
    if (!preview || !canApply || requestInFlight) return;
    const applyingPreview = preview;
    setConfirmOpen(false); setIsApplying(true); setMessage(null);
    try {
      const response = await fetch("/api/admin/catalog/apply", {
        method: "POST", credentials: "include", headers: { "X-Catalog-Apply": "1" }, body: makeFormData(applyingPreview),
      });
      const body: unknown = await response.json().catch(() => null);
      const hasJsonError = Boolean(body && typeof body === "object" && "error" in body && typeof body.error === "string");
      if (response.status === 200 && isApplyCounts(body)) {
        toast.success(`Applied ${body.creates} create${body.creates === 1 ? "" : "s"}, ${body.updates} update${body.updates === 1 ? "" : "s"}, ${body.deletes} delete${body.deletes === 1 ? "" : "s"}`);
        resetImport();
        return;
      }
      if (response.status === 409 && hasJsonError) {
        const text = errorMessage(body, "Catalog changed since preview: preview again");
        setMessage(text); toast.error(text); setPreview(null); setBackupTakenForHash(null); return;
      }
      if (response.status === 400 && hasJsonError) {
        const text = errorMessage(body, "Preview has problems");
        setMessage(text); toast.error(text);
        if (body && typeof body === "object" && "plan" in body && isPreview(body.plan)) { setPreview(body.plan); setBackupTakenForHash(null); }
        return;
      }
      if ((response.status === 401 || response.status === 403 || response.status === 413) && hasJsonError) {
        const text = errorMessage(body, "Apply did not run"); setMessage(text); toast.error(text); return;
      }
      if (response.status === 500 && errorMessage(body, "") === "Apply failed, nothing was changed") {
        setMessage("Apply failed, nothing was changed"); toast.error("Apply failed, nothing was changed"); return;
      }
      const unknown = "Result unknown. Close this, re-export and check the catalog. If you preview the same files again and see 0 changes, or errors saying rows already exist or ids don't exist, the apply went through.";
      setMessage(unknown); toast.error("Result unknown. Re-export and check the catalog."); setPreview(null); setBackupTakenForHash(null);
    } catch {
      const unknown = "Result unknown. Close this, re-export and check the catalog. If you preview the same files again and see 0 changes, or errors saying rows already exist or ids don't exist, the apply went through.";
      setMessage(unknown); toast.error("Result unknown. Re-export and check the catalog."); setPreview(null); setBackupTakenForHash(null);
    } finally {
      await invalidateCatalogQueries();
      setIsApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="!w-[min(96vw,1050px)] !max-w-[min(96vw,1050px)] max-h-[90dvh] overflow-hidden flex flex-col rounded-none">
        <DialogHeader className="shrink-0 border-b border-border pb-4 pr-8">
          <DialogTitle className="font-display text-base tracking-[0.16em] uppercase">Catalog CSV</DialogTitle>
          <DialogDescription>Export products, categories, and sections together, edit them externally, then preview and apply reviewed changes.</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto pr-1 space-y-7 py-1">
          <section className="border border-border p-4 bg-muted/20">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="font-semibold text-sm">1. Download catalog</p><p className="text-xs text-muted-foreground mt-1">One ZIP containing UTF-8 CSV files for sections, categories, and products.</p></div>
              <Button className="rounded-none" disabled={requestInFlight} onClick={() => downloadCatalog("/api/admin/catalog/export")}><FileArchive className="h-4 w-4 mr-2" />Download catalog (.zip)</Button>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 text-xs">{(["sections", "categories", "products"] as const).map((file) => <button key={file} disabled={requestInFlight} type="button" className="inline-flex items-center gap-1.5 text-red-700 hover:underline disabled:opacity-50" onClick={() => downloadCatalog(`/api/admin/catalog/export/${file}`)}><Download className="h-3.5 w-3.5" />{file}.csv</button>)}</div>
          </section>

          <section className="border border-border p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div><p className="font-semibold text-sm">2. Upload CSV files</p><p className="text-xs text-muted-foreground mt-1">Choose one to three files, preview the plan, then save a backup before applying it.</p></div>
              <div className="flex gap-2 shrink-0">
                <input ref={inputRef} disabled={requestInFlight} type="file" accept=".csv,text/csv,.zip,application/zip" multiple className="hidden" onChange={(event) => handleFiles(event.target.files)} />
                <Button type="button" variant="outline" className="rounded-none" disabled={requestInFlight} onClick={() => inputRef.current?.click()}><Upload className="h-4 w-4 mr-2" />Choose CSV files</Button>
                <Button type="button" className="rounded-none" disabled={files.length === 0 || requestInFlight} onClick={previewChanges}><FileSpreadsheet className="h-4 w-4 mr-2" />{isPreviewing ? "Previewing…" : "Preview changes"}</Button>
              </div>
            </div>
            {files.length > 0 && <p className="mt-3 font-mono text-xs text-muted-foreground">Selected: {files.map((file) => file.name).join(", ")}</p>}
            <label className="mt-4 flex items-start gap-2 text-sm cursor-pointer">
              <input type="checkbox" disabled={requestInFlight} checked={restoreMode} onChange={(event) => { setRestoreMode(event.target.checked); setPreview(null); setBackupTakenForHash(null); setMessage(null); }} className="mt-0.5 h-4 w-4 accent-[#c73e3a] disabled:opacity-50" />
              <span><span className="font-medium">Restoring a backup (ignore 'changed in admin since export' conflicts)</span><span className="block mt-1 text-xs text-muted-foreground">A restore puts back values. It doesn't remove rows created since the backup, and it can't bring back deleted products or sections by id. Re-add those as new rows with a blank id.</span></span>
            </label>
            {message && <p className="mt-3 text-sm text-red-700">{message}</p>}
          </section>

          {preview && <section className="space-y-5 pb-4">
            <div><p className="font-semibold text-sm mb-2">Preview summary</p><div className="grid grid-cols-2 sm:grid-cols-6 gap-2"><Count label="Create" value={preview.creates} /><Count label="Update" value={preview.updates} /><Count label="Delete" value={preview.deletes} tone={preview.deletes ? "danger" : "default"} /><Count label="Unchanged" value={preview.unchanged} /><Count label="Conflicts" value={preview.conflicts.length} tone={preview.conflicts.length ? "warning" : "default"} /><Count label="Errors" value={preview.errors.length} tone={preview.errors.length ? "danger" : "default"} /></div></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div className="border border-border p-3 bg-muted/20"><p className="text-xs font-semibold uppercase tracking-wider">Storefront safety</p><p className="mt-2 text-sm">Available, Regular mode: <span className="font-mono">{preview.safety.visibleAvailableBefore} → {preview.safety.visibleAvailableAfter}</span></p></div><div className="border border-border p-3 bg-muted/20"><p className="text-xs font-semibold uppercase tracking-wider">Plan hash</p><p className="mt-2 font-mono text-[11px] break-all text-muted-foreground">{preview.planHash}</p></div></div>
            {preview.operations.length === 0 && <p className="border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">Nothing to apply</p>}
            {tooManyOperations && <p className="border border-red-300 bg-red-50 px-3 py-4 text-sm text-red-900">Too many changes: split the file</p>}
            {preview.blockers.length > 0 && <div className="border border-red-300 bg-red-50 p-3 text-sm text-red-900"><p className="font-semibold mb-1">Blockers</p><ul className="list-disc pl-5 space-y-1">{preview.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul></div>}
            {preview.warnings.length > 0 && <div className="border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><p className="font-semibold mb-1">Warnings</p><ul className="list-disc pl-5 space-y-1">{preview.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>}
            {(preview.errors.length > 0 || preview.conflicts.length > 0) && <div className="border border-red-300 bg-red-50 p-3 text-sm text-red-900"><p className="font-semibold mb-2">Errors and conflicts</p><ul className="space-y-1">{[...preview.errors, ...preview.conflicts].map((entry, index) => <li key={`${entry.file}-${entry.row}-${index}`}><span className="font-mono text-xs">{entry.file}: row {entry.row}</span> — {entry.message}</li>)}</ul></div>}
            <div className="border border-border p-4 bg-muted/20 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-sm">3. Download backup, then apply</p><p className="mt-1 text-xs text-muted-foreground">Backup status: {backupTakenForHash === preview.planHash ? "saved for this exact plan" : "download required for this plan"}.</p></div><div className="flex gap-2"><Button type="button" variant="outline" className="rounded-none" disabled={requestInFlight} onClick={downloadBackup}><Download className="h-4 w-4 mr-2" />{isDownloadingBackup ? "Downloading…" : "Download backup"}</Button><Button type="button" className="rounded-none" disabled={!canApply} onClick={() => { setConfirmationText(""); setConfirmOpen(true); }}><ShieldCheck className="h-4 w-4 mr-2" />Apply changes</Button></div></div>
            <div><p className="font-semibold text-sm mb-2">Per-row changes</p>{displayChanges.length === 0 ? <p className="border border-dashed border-border px-3 py-5 text-sm text-muted-foreground">No proposed changes.</p> : <div className="border border-border overflow-x-auto"><table className="w-full min-w-[760px] text-xs"><thead className="bg-muted/50 text-left uppercase tracking-wider text-muted-foreground"><tr><th className="p-2">Action</th><th className="p-2">Item</th><th className="p-2">Field</th><th className="p-2">Old</th><th className="p-2">New</th><th className="p-2">Source</th></tr></thead><tbody>{displayChanges.map((change, index) => <tr key={`${change.action}-${change.item}-${change.field}-${index}`} className={`border-t border-border/70 align-top ${change.action === "delete" ? "bg-red-50/70" : ""}`}><td className={`p-2 font-semibold uppercase ${actionClass(change.action)}`}>{change.action}</td><td className="p-2 font-mono">{change.item}</td><td className="p-2 font-semibold">{change.field}</td><td className="p-2 break-words max-w-48">{printable(change.oldValue)}</td><td className="p-2 break-words max-w-48">{printable(change.newValue)}</td><td className="p-2 font-mono text-muted-foreground">{change.file}{change.row ? `:${change.row}` : ""}</td></tr>)}</tbody></table></div>}</div>
          </section>}
        </div>
      </DialogContent>

      <AlertDialog open={confirmOpen} onOpenChange={(next) => { if (!isApplying) setConfirmOpen(next); }}>
        <AlertDialogContent className="rounded-none max-w-lg">
          <AlertDialogHeader><AlertDialogTitle>Apply catalog changes?</AlertDialogTitle><AlertDialogDescription>This will apply the exact reviewed plan: {preview?.creates ?? 0} create{preview?.creates === 1 ? "" : "s"}, {preview?.updates ?? 0} update{preview?.updates === 1 ? "" : "s"}, and {preview?.deletes ?? 0} delete{preview?.deletes === 1 ? "" : "s"}.</AlertDialogDescription></AlertDialogHeader>
          {deletes.length > 0 && <div className="max-h-40 overflow-y-auto border border-red-200 bg-red-50 p-3 text-sm text-red-900"><p className="font-semibold mb-1">Deletes</p><ul className="list-disc pl-5 space-y-1">{deletes.map((change, index) => <li key={`${change.item}-${change.field}-${index}`}>{change.item}: {change.field} — {printable(change.oldValue)} → {printable(change.newValue)}</li>)}</ul></div>}
          {restoreMode && <p className="text-sm text-amber-800">Restore mode will overwrite {overwrittenRows} row{overwrittenRows === 1 ? "" : "s"} changed in admin since export.</p>}
          {requiresTypedConfirmation && <div className="space-y-2"><label className="text-sm font-medium" htmlFor="catalog-apply-confirmation">Type APPLY to confirm</label><Input id="catalog-apply-confirmation" value={confirmationText} onChange={(event) => setConfirmationText(event.target.value)} autoComplete="off" /></div>}
          <AlertDialogFooter><AlertDialogCancel disabled={isApplying}>Cancel</AlertDialogCancel><AlertDialogAction disabled={isApplying || (requiresTypedConfirmation && confirmationText !== "APPLY")} onClick={(event) => { event.preventDefault(); void applyChanges(); }}>Apply changes</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
