import { useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Upload, FileSpreadsheet, CheckCircle, XCircle, Loader2, X, ChevronDown, ChevronUp, Maximize2, Minimize2,
} from "lucide-react";
import { toast } from "sonner";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

export function CertificationImportDialog({ open, onClose, onImported }: Props) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rafRef = useRef<number>(0);

  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [certType, setCertType] = useState<"product" | "enterprise">("product");
  const [duplicateStrategy, setDuplicateStrategy] = useState<"skip" | "overwrite">("skip");
  const [sheetInfo, setSheetInfo] = useState<{ name: string; rows: number; valid: boolean }[]>([]);
  const [selectedSheets, setSelectedSheets] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<Record<string, unknown>[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [importPhase, setImportPhase] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null);
  const [errorsExpanded, setErrorsExpanded] = useState(false);
  const [maximized, setMaximized] = useState(true);

  const existingQuery = trpc.certifications.list.useQuery({ page: 1, pageSize: 1 });
  const existingCount = existingQuery.data?.total ?? 0;

  const animateProgress = useCallback((from: number, to: number, duration: number) => {
    cancelAnimationFrame(rafRef.current);
    const start = performance.now();
    const frame = (now: number) => {
      const elapsed = now - start;
      const p = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setProgress(from + (to - from) * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
  }, []);

  const importMut = trpc.certifications.import.useMutation({
    onSuccess: (data) => {
      cancelAnimationFrame(rafRef.current);
      setProgress(100);
      setImportPhase(t("import.phaseComplete"));
      setTimeout(() => { setImportPhase(null); setProgress(0); }, 800);
      setResult(data);
      onImported();
      toast.success(`${t("certifications.import.success")}: ${data.imported}`);
    },
    onError: (e) => {
      cancelAnimationFrame(rafRef.current);
      setImportPhase(null);
      setProgress(0);
      toast.error(e.message);
    },
  });

  const handleFileSelect = async (f: File) => {
    if (f.size > MAX_FILE_SIZE) { toast.error(t("certifications.import.fileTooLarge")); return; }
    if (!f.name.match(/\.(xlsx|xls)$/i)) { toast.error(t("certifications.import.readError")); return; }
    setFile(f);
    setResult(null);
    setErrorsExpanded(false);
    try {
      const XLSX = await import("xlsx");
      const buffer = await f.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const certHeaders = ["证书编号", "certNo", "Cert No"];
      const info = wb.SheetNames.map(sn => {
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(wb.Sheets[sn], { defval: "" });
        const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
        const valid = headers.some(h => certHeaders.some(c => h.trim() === c));
        return { name: sn, rows: rows.length, valid };
      });
      setSheetInfo(info);
      const validSheets = info.filter(s => s.valid);
      setSelectedSheets(new Set(validSheets.map(s => s.name)));
      const firstValid = info.find(s => s.valid);
      if (firstValid) {
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[firstValid.name], { defval: "" });
        setPreview(rows.slice(0, 5));
      } else {
        setPreview([]);
      }
    } catch {
      setSheetInfo([]); setSelectedSheets(new Set()); setPreview([]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f);
  };

  const resetState = () => {
    setFile(null); setSheetInfo([]); setSelectedSheets(new Set()); setPreview([]);
    setResult(null); setErrorsExpanded(false); setImportPhase(null); setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = () => { resetState(); onClose(); };

  const handleStartImport = () => {
    if (!file || selectedSheets.size === 0) return;
    if (existingCount > 0) { setConfirmOpen(true); } else { doImport(); }
  };

  const doImport = () => {
    if (!file) return;
    setConfirmOpen(false);
    setImportPhase(t("import.phaseParsing"));
    animateProgress(0, 25, 1500);

    const reader = new FileReader();
    reader.onload = () => {
      setImportPhase(t("import.phaseUploading"));
      animateProgress(25, 55, 2000);
      const base64 = (reader.result as string).split(",")[1];
      importMut.mutate({ fileBase64: base64, certType, duplicateStrategy });
      setTimeout(() => {
        if (importMut.isPending) {
          setImportPhase(t("import.phaseProcessing"));
          animateProgress(55, 90, 8000);
        }
      }, 2500);
    };
    reader.readAsDataURL(file);
  };

  const isImporting = importMut.isPending || (importPhase !== null && progress > 0 && progress < 100);
  const validSheets = sheetInfo.filter(s => s.valid);
  const allSelected = validSheets.length > 0 && selectedSheets.size === validSheets.length;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className={`${maximized ? "sm:w-[95vw] sm:max-w-[95vw]" : "sm:max-w-lg"} max-h-[85vh] overflow-y-auto`}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{t("certifications.import.title")}</DialogTitle>
            <button
              onClick={() => setMaximized(!maximized)}
              className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-accent transition-colors"
              title={maximized ? t("common.restore") : t("common.maximize")}
            >
              {maximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer ${
              isDragging ? "border-primary bg-primary/5" : file ? "border-success-border bg-success-soft/50" : "border-border hover:border-primary/40"
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <FileSpreadsheet className="w-8 h-8 text-success" />
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB &middot; {t("import.changeFile")}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-8 h-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">{t("eflash.import.dropzone")}</p>
                <p className="text-xs text-muted-foreground/60">{t("certifications.import.uploadExcel")}</p>
              </div>
            )}
          </div>

          {/* Sheet selection */}
          {file && sheetInfo.length > 0 && (
            <div className="bg-muted/30 rounded-lg p-3">
              {sheetInfo.length > 1 ? (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                      <input type="checkbox" checked={allSelected}
                        ref={el => { if (el) el.indeterminate = selectedSheets.size > 0 && !allSelected; }}
                        onChange={() => { if (allSelected) setSelectedSheets(new Set()); else setSelectedSheets(new Set(validSheets.map(s => s.name))); }}
                        className="w-4 h-4 rounded" />
                      {t("import.selectAllSheets", { defaultValue: "全选" })}
                    </label>
                    <span className="text-xs text-muted-foreground">
                      {t("import.selectedCount", { defaultValue: `已选 ${selectedSheets.size}/${validSheets.length}` })}
                    </span>
                  </div>
                  <div className="divide-y divide-border/50 border rounded bg-background">
                    {sheetInfo.map(s => (
                      <label key={s.name} className={`flex items-center gap-3 px-3 py-2 text-sm ${s.valid ? "cursor-pointer hover:bg-accent/30" : "opacity-50 cursor-not-allowed"}`}>
                        <input type="checkbox" checked={selectedSheets.has(s.name)} disabled={!s.valid}
                          onChange={() => { setSelectedSheets(prev => { const next = new Set(prev); if (next.has(s.name)) next.delete(s.name); else next.add(s.name); return next; }); }}
                          className="w-4 h-4 rounded" />
                        <span className="flex-1 truncate">{s.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{t("import.rows", { count: s.rows, defaultValue: `${s.rows} 行` })}</span>
                        {s.valid ? <span className="text-xs text-success">✓</span> : <span className="text-xs text-muted-foreground">{t("certifications.import.sheetInvalid")}</span>}
                      </label>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {sheetInfo[0].name} &middot; {t("import.rows", { count: sheetInfo[0].rows, defaultValue: `${sheetInfo[0].rows} 行` })}
                  {sheetInfo[0].valid ? " ✓" : ` — ${t("certifications.import.sheetInvalid")}`}
                </p>
              )}
            </div>
          )}

          {file && sheetInfo.length > 0 && validSheets.length === 0 && (
            <p className="text-sm text-destructive">{t("certifications.import.noValidSheet")}</p>
          )}

          {/* Data preview */}
          {preview.length > 0 && (
            <div className="text-xs text-muted-foreground">
              <p className="font-medium mb-1">{t("certifications.import.preview")} ({preview.length} {t("import.rows", { count: 0, defaultValue: "行" })})</p>
              <div className="bg-muted/30 rounded p-2 overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>{Object.keys(preview[0]).slice(0, 8).map(k => <th key={k} className="px-2 py-1 text-left font-medium whitespace-nowrap">{k}</th>)}</tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i}>{Object.values(row).slice(0, 8).map((v, j) => <td key={j} className="px-2 py-1 break-all">{String(v ?? "")}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Config options */}
          {file && validSheets.length > 0 && !isImporting && !result && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{t("certifications.import.selectType")}</Label>
                <Select value={certType} onValueChange={(v: "product" | "enterprise") => setCertType(v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="product">{t("certifications.tabs.product")}</SelectItem>
                    <SelectItem value="enterprise">{t("certifications.tabs.enterprise")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">{t("certifications.import.duplicateStrategy")}</Label>
                <Select value={duplicateStrategy} onValueChange={(v: "skip" | "overwrite") => setDuplicateStrategy(v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skip">{t("certifications.import.skipDuplicate")}</SelectItem>
                    <SelectItem value="overwrite">{t("certifications.import.overwriteDuplicate")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Progress or Buttons */}
          {file && validSheets.length > 0 && (
            isImporting ? (
              <div className="bg-card border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{importPhase}...</p>
                    <p className="text-xs text-muted-foreground">{Math.round(progress)}%</p>
                  </div>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            ) : !result && (
              <div className="flex gap-2">
                <Button onClick={handleStartImport} disabled={selectedSheets.size === 0} className="flex-1 h-11 gap-2">
                  <Upload className="w-4 h-4" />{t("import.startImport")}
                </Button>
                <Button variant="outline" onClick={resetState} className="h-11 gap-2">
                  <X className="w-4 h-4" />{t("import.cancelImport")}
                </Button>
              </div>
            )
          )}

          {/* Result */}
          {result && (
            <div className={`rounded-lg p-4 border ${result.errors.length === 0 ? "bg-success-soft border-success-border" : "bg-muted"}`}>
              <div className="flex items-start gap-3">
                {result.errors.length === 0 ? (
                  <CheckCircle className="w-5 h-5 text-success mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-muted-foreground mt-0.5" />
                )}
                <div className="flex-1 space-y-2">
                  <p className="text-sm font-medium">
                    {t("certifications.import.success")}: {result.imported}
                    {result.errors.length > 0 && ` · ${t("certifications.import.failed")}: ${result.errors.length}`}
                  </p>
                  {result.errors.length > 0 && (
                    <div>
                      <button onClick={() => setErrorsExpanded(!errorsExpanded)} className="text-xs text-primary hover:underline flex items-center gap-1">
                        {errorsExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {errorsExpanded ? t("certifications.import.collapseAll") : `${t("certifications.import.expandAll")} (${result.errors.length})`}
                      </button>
                      <ul className="list-disc ml-4 mt-1 text-xs text-muted-foreground space-y-0.5">
                        {(errorsExpanded ? result.errors : result.errors.slice(0, 10)).map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                        {!errorsExpanded && result.errors.length > 10 && <li>...</li>}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Confirmation Dialog */}
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("certifications.import.confirmTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("certifications.import.confirmMessage", { count: existingCount })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={doImport}>{t("common.confirm")}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
