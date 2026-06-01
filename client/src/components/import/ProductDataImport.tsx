import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, X,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { ImportHistory } from "./ImportHistory";

export function ProductDataImport() {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [importResult, setImportResult] = useState<{
    sheetsImported: number; productsImported: number; hasSummary: boolean;
  } | null>(null);
  const [sheetInfo, setSheetInfo] = useState<{ name: string; rows: number; hasValidCol: boolean }[]>([]);
  const [selectedSheets, setSelectedSheets] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Progress animation state
  const [importPhase, setImportPhase] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number>(0);

  const utils = trpc.useUtils();

  const hasDataQuery = trpc.cpl.hasData.useQuery();
  const hasExistingData = hasDataQuery.data?.hasData ?? false;
  const existingCount = hasDataQuery.data?.count ?? 0;

  // Duplicate file detection
  const duplicateCheck = trpc.importLogs.checkDuplicate.useQuery(
    { fileName: file?.name ?? "" },
    { enabled: !!file }
  );
  const duplicates = duplicateCheck.data ?? [];
  const hasDuplicates = duplicates.length > 0;

  const animateProgress = useCallback((from: number, to: number, duration: number) => {
    cancelAnimationFrame(rafRef.current);
    const start = performance.now();
    const frame = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setProgress(from + (to - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
  }, []);

  const importMutation = trpc.cpl.import.useMutation({
    onSuccess: (data) => {
      cancelAnimationFrame(rafRef.current);
      setProgress(100);
      setImportPhase(t('import.phaseComplete'));
      setTimeout(() => {
        setImportPhase(null);
        setProgress(0);
      }, 800);
      setImportResult(data);
      setFile(null); setSheetInfo([]); setSelectedSheets(new Set());
      toast.success(t('import.importSuccess'));
      utils.cpl.sheets.invalidate();
      utils.cpl.products.invalidate();
      utils.cpl.summary.invalidate();
      utils.cpl.hasData.invalidate();
      utils.importLogs.list.invalidate();
    },
    onError: (err) => {
      cancelAnimationFrame(rafRef.current);
      setImportPhase(null);
      setProgress(0);
      toast.error(err.message || t('import.importFailed'));
    },
  });

  const handleFileSelect = async (f: File) => {
    if (!f.name.endsWith(".xlsx") && !f.name.endsWith(".xls")) {
      toast.error(t('import.selectFile')); return;
    }
    setFile(f); setImportResult(null);
    try {
      const XLSX = await import("xlsx");
      const buffer = await f.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const info = wb.SheetNames.map(sn => {
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(wb.Sheets[sn], { defval: "" });
        const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
        const hasValidCol = headers.some(h => ["型号", "Model", "产品型号", "产品组件", "销售类别", "Model No", "Section", "Sales Category"].includes(h.trim()));
        return { name: sn, rows: rows.length, hasValidCol };
      });
      setSheetInfo(info);
      setSelectedSheets(new Set(info.filter(s => s.hasValidCol).map(s => s.name)));
    } catch {
      setSheetInfo([]);
      setSelectedSheets(new Set());
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f);
  };

  const handleStartImport = () => {
    if (!file) return;
    if (hasExistingData || hasDuplicates) {
      setConfirmOpen(true);
    } else {
      doImport();
    }
  };

  const doImport = async () => {
    if (!file) return;
    setConfirmOpen(false);

    // Phase 1: parsing file
    setImportPhase(t('import.phaseParsing'));
    animateProgress(0, 25, 1500);

    const reader = new FileReader();
    reader.onload = () => {
      // Phase 2: uploading data
      setImportPhase(t('import.phaseUploading'));
      animateProgress(25, 55, 2000);

      const base64 = (reader.result as string).split(",")[1];
      importMutation.mutate({
        fileBase64: base64,
        fileName: file.name,
        selectedSheets: Array.from(selectedSheets),
      });

      // Phase 3: processing (after upload completes)
      setTimeout(() => {
        if (importMutation.isPending) {
          setImportPhase(t('import.phaseProcessing'));
          animateProgress(55, 90, 8000);
        }
      }, 2500);
    };
    reader.readAsDataURL(file);
  };

  const isImporting = importMutation.isPending || (importPhase !== null && progress < 100 && progress > 0);

  return (
    <>
      {/* Info */}
      <div className="bg-card border rounded-lg p-5 space-y-2">
        <h3 className="text-sm font-medium text-foreground">{t('import.instructions')}</h3>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>· {t('import.supportFormat')}</li>
          <li>· {t('import.overwriteExplain')}</li>
          <li>· {t('import.patience')}</li>
        </ul>
      </div>

      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-10 text-center transition-all cursor-pointer ${
          isDragging ? "border-primary bg-primary/5" : file ? "border-success-border bg-success-soft/50" : "border-border hover:border-primary/40 hover:bg-accent/30"
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
        {file ? (
          <div className="flex flex-col items-center gap-3">
            <FileSpreadsheet className="w-10 h-10 text-success" />
            <p className="text-sm font-medium text-foreground">{file.name}</p>
            <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB &middot; {t('import.changeFile')}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Upload className="w-10 h-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">{t('import.dropzone')}</p>
            <p className="text-xs text-muted-foreground">{t('import.formatHint')}</p>
          </div>
        )}
      </div>

      {/* Sheet selection */}
      {file && sheetInfo.length > 1 && (() => {
        const validSheets = sheetInfo.filter(s => s.hasValidCol);
        const allSelected = validSheets.length > 0 && selectedSheets.size === validSheets.length;
        return (
        <div className="bg-muted/30 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={allSelected}
                ref={el => { if (el) el.indeterminate = selectedSheets.size > 0 && !allSelected; }}
                onChange={() => {
                  if (allSelected) setSelectedSheets(new Set());
                  else setSelectedSheets(new Set(validSheets.map(s => s.name)));
                }}
                className="w-4 h-4 rounded"
              />
              {t('import.selectAllSheets', { defaultValue: '全选/取消全选' })}
            </label>
            <span className="text-xs text-muted-foreground">
              {t('import.selectedCount', { defaultValue: `已选 ${selectedSheets.size}/${validSheets.length}` })}
            </span>
          </div>
          <div className="divide-y divide-border/50 border rounded bg-background">
            {sheetInfo.map(s => (
              <label key={s.name} className={`flex items-center gap-3 px-3 py-2 text-sm ${s.hasValidCol ? "cursor-pointer hover:bg-accent/30" : "cursor-not-allowed opacity-50"}`}>
                <input
                  type="checkbox"
                  checked={selectedSheets.has(s.name)}
                  disabled={!s.hasValidCol}
                  onChange={() => {
                    setSelectedSheets(prev => {
                      const next = new Set(prev);
                      if (next.has(s.name)) next.delete(s.name); else next.add(s.name);
                      return next;
                    });
                  }}
                  className="w-4 h-4 rounded"
                />
                <span className="flex-1 truncate">{s.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {t('import.rows', { count: s.rows, defaultValue: `${s.rows} 行` })} {s.hasValidCol ? "✓" : t('import.invalid')}
                </span>
              </label>
            ))}
          </div>
        </div>
        );
      })()}

      {/* Import button or Progress bar */}
      {file && (
        isImporting ? (
          <div className="bg-card border rounded-lg p-5 space-y-3">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{importPhase}...</p>
                <p className="text-xs text-muted-foreground">{Math.round(progress)}%</p>
              </div>
            </div>
            <Progress value={progress} className="h-2 transition-all" />
          </div>
        ) : (
          <div className="flex gap-2">
            <Button onClick={handleStartImport} disabled={selectedSheets.size === 0} className="flex-1 h-11 gap-2 shadow-sm">
              <Upload className="w-4 h-4" />{t('import.startImport')}
            </Button>
            <Button variant="outline" onClick={() => { setFile(null); setSheetInfo([]); setSelectedSheets(new Set()); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="h-11 gap-2">
              <X className="w-4 h-4" />{t('import.cancelImport')}
            </Button>
          </div>
        )
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {hasDuplicates ? t('import.duplicateTitle') : t('import.confirmOverwrite')}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              {hasDuplicates && (
                <>
                  <p className="font-medium text-amber-600">
                    {t('import.duplicateWarning', { count: duplicates.length, fileName: file?.name ?? "" })}
                  </p>
                  <div className="bg-muted/50 rounded p-2 text-xs space-y-1 max-h-32 overflow-y-auto">
                    {duplicates.map((d: any) => (
                      <div key={d.id} className="flex gap-2 items-center">
                        <span className="text-muted-foreground">{new Date(d.createdAt).toLocaleDateString()}</span>
                        <span>{d.sheetsCount} {t('import.sheetNames', { defaultValue: '表格' })}</span>
                        <span>{d.productsCount} {t('import.rows', { count: 0, defaultValue: '产品' })}</span>
                        {d.isActive && (
                          <span className="text-xs text-amber-600 font-medium">{t('import.duplicateActive')}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
              {hasExistingData && (
                <p className="text-destructive font-medium">{t('import.existingData', { count: existingCount })}</p>
              )}
              <p>{t('import.overwriteDesc')}</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={doImport} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {hasDuplicates ? t('import.proceedAnyway') : t('import.overwrite')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Result */}
      {importResult && (
        <div className="bg-success-soft border border-success-border rounded-lg p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-success mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">{t('import.success')}</p>
              <div className="text-sm text-success space-y-1">
                <p>· {t('import.importedSheets', { count: importResult.sheetsImported })}</p>
                <p>· {t('import.importedProducts', { count: importResult.productsImported })}</p>
                <p>· {t('menu.summary')}: {importResult.hasSummary ? t('import.summaryUpdated') : t('import.summaryNone')}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {importMutation.isError && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive">{t('import.failed')}</p>
              <p className="text-sm text-destructive/80 mt-1">{importMutation.error?.message || t('import.checkFormat')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Import History */}
      <ImportHistory />
    </>
  );
}
