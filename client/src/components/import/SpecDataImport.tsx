import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { SpecImportHistory } from "./SpecImportHistory";

export function SpecDataImport() {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [preview, setPreview] = useState<any[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [importResult, setImportResult] = useState<{ modelCount: number; sets?: { name: string; modelCount: number }[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const importMutation = trpc.productSpecs.importSet.useMutation({
    onSuccess: (data) => {
      setImportResult({ modelCount: data.totalModels || data.modelCount, sets: data.sets });
      toast.success(t('import.specImportSuccess', { count: data.totalModels || data.modelCount }));
      reset();
      utils.productSpecs.listSets.invalidate();
    },
    onError: (err: any) => toast.error(err.message || t('techSpecs.importFailed')),
  });

  const deleteSetMutation = trpc.productSpecs.deleteSet.useMutation();

  // Check existing sets
  const setsQuery = trpc.productSpecs.listSets.useQuery({ page: 1, pageSize: 100 });
  const existingSets = setsQuery.data?.items ?? [];
  const existingCount = existingSets.length;
  const hasExistingData = existingCount > 0;

  const reset = () => { setFile(null); setName(""); setDescription(""); setPreview([]); setSheetInfo([]); setSelectedSheets(new Set()); };

  const [sheetInfo, setSheetInfo] = useState<{ name: string; rows: number; hasModelCol: boolean }[]>([]);
  const [selectedSheets, setSelectedSheets] = useState<Set<string>>(new Set());

  const handleFileSelect = async (f: File) => {
    if (!f.name.endsWith(".xlsx") && !f.name.endsWith(".xls") && !f.name.endsWith(".csv")) {
      toast.error(t('import.specFormatHint')); return;
    }
    setFile(f);
    setImportResult(null);
    if (!name) setName(f.name.replace(/\.[^.]+$/, ""));
    try {
      const XLSX = await import("xlsx");
      const buffer = await f.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const modelAliases = ["型号", "Model", "产品型号", "Product Model"];
      // Detect each sheet's validity
      const info = wb.SheetNames.map(sn => {
        const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval: "" });
        const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
        const hasModelCol = headers.some(h => modelAliases.some(a => h.trim().toLowerCase() === a.toLowerCase()));
        return { name: sn, rows: rows.length, hasModelCol };
      });
      setSheetInfo(info);
      // Auto-select all valid sheets
      setSelectedSheets(new Set(info.filter(s => s.hasModelCol).map(s => s.name)));
      // Preview from first valid sheet
      const firstValid = info.find(s => s.hasModelCol);
      if (firstValid) {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[firstValid.name], { defval: "" });
        setPreview(rows.slice(0, 5));
      } else {
        setPreview([]);
      }
    } catch {
      setPreview([]);
      setSheetInfo([]);
      setSelectedSheets(new Set());
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f);
  };

  const handleStartImport = () => {
    if (!file || !name) return;
    if (hasExistingData) {
      setConfirmOpen(true);
    } else {
      doImport("merge");
    }
  };

  const doImport = async (mode: "merge" | "overwrite") => {
    setConfirmOpen(false);
    if (!file || !name) return;

    // Overwrite: delete all existing sets first
    if (mode === "overwrite") {
      for (const s of existingSets) {
        await deleteSetMutation.mutateAsync({ id: s.id });
      }
      utils.productSpecs.listSets.invalidate();
    }

    const buffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(buffer);
    const base64 = btoa(Array.from(uint8).map(b => String.fromCharCode(b)).join(""));
    importMutation.mutate({ fileBase64: base64, fileName: file.name, name, description: description || undefined, selectedSheets: Array.from(selectedSheets) });
  };

  return (
    <>
      {/* Info */}
      <div className="bg-card border rounded-lg p-5 space-y-2">
        <h3 className="text-sm font-medium text-foreground">{t('import.specInstructions')}</h3>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>· {t('import.specSupportFormat')}</li>
          <li>· {t('import.specFormatExplain')}</li>
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
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
        {file ? (
          <div className="flex flex-col items-center gap-3">
            <FileSpreadsheet className="w-10 h-10 text-success" />
            <p className="text-sm font-medium text-foreground">{file.name}</p>
            <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB &middot; {t('import.changeFile')}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Upload className="w-10 h-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">{t('import.specDropzone')}</p>
            <p className="text-xs text-muted-foreground">{t('import.specFormatHint')}</p>
          </div>
        )}
      </div>

      {/* Form fields & buttons */}
      {file && (
        <div className="space-y-3">
          {/* Sheet selection */}
          {sheetInfo.length > 1 && (
            <div className="bg-muted/30 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedSheets.size === sheetInfo.filter(s => s.hasModelCol).length && sheetInfo.filter(s => s.hasModelCol).length > 0}
                    ref={el => { if (el) el.indeterminate = selectedSheets.size > 0 && selectedSheets.size < sheetInfo.filter(s => s.hasModelCol).length; }}
                    onChange={() => {
                      const validSheets = sheetInfo.filter(s => s.hasModelCol);
                      if (selectedSheets.size === validSheets.length) {
                        setSelectedSheets(new Set());
                      } else {
                        setSelectedSheets(new Set(validSheets.map(s => s.name)));
                      }
                    }}
                    className="w-4 h-4 rounded"
                  />
                  {t('import.selectAllSheets', { defaultValue: '全选/取消全选' })}
                </label>
                <span className="text-xs text-muted-foreground">
                  {t('import.selectedCount', { defaultValue: `已选 ${selectedSheets.size}/${sheetInfo.filter(s => s.hasModelCol).length}` })}
                </span>
              </div>
              <div className="divide-y divide-border/50 border rounded bg-background">
                {sheetInfo.map(s => (
                  <label
                    key={s.name}
                    className={`flex items-center gap-3 px-3 py-2 text-sm cursor-pointer ${
                      s.hasModelCol ? 'hover:bg-accent/30' : 'opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedSheets.has(s.name)}
                      disabled={!s.hasModelCol}
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
                    <span className="text-xs text-muted-foreground shrink-0">{t('import.rows', { count: s.rows, defaultValue: `${s.rows} 行` })}</span>
                    {s.hasModelCol
                      ? <span className="text-xs text-success shrink-0">✓</span>
                      : <span className="text-xs text-muted-foreground shrink-0">{t('import.invalid', { defaultValue: '无效' })}</span>
                    }
                  </label>
                ))}
              </div>
            </div>
          )}

          <Input placeholder={t('import.specName')} value={name} onChange={e => setName(e.target.value)} className="h-10" />
          <Textarea placeholder={t('import.specDescription')} value={description} onChange={e => setDescription(e.target.value)} rows={2} />

          {/* Preview */}
          {preview.length > 0 && (
            <div className="text-xs text-muted-foreground">
              <p>{t('import.specPreview', { count: preview.length })}</p>
              <div className="mt-1 bg-muted/30 rounded p-2 overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>{Object.keys(preview[0]).slice(0, 6).map(k => <th key={k} className="px-2 py-1 text-left font-medium">{k}</th>)}</tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i}>{Object.values(row).slice(0, 6).map((v: any, j) => <td key={j} className="px-2 py-1">{String(v)}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2">
            <Button onClick={handleStartImport} disabled={!name || importMutation.isPending || selectedSheets.size === 0} className="flex-1 h-11 gap-2 shadow-sm">
              {importMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />{t('import.importing')}</> : <><Upload className="w-4 h-4" />{t('import.startImport')}</>}
            </Button>
            <Button variant="outline" onClick={reset} disabled={importMutation.isPending} className="h-11 gap-2">
              <X className="w-4 h-4" />{t('import.cancelImport')}
            </Button>
          </div>
        </div>
      )}

      {/* Confirmation Dialog — same style as product import */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('import.specConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p className="text-destructive font-medium">{t('import.specExistingData', { count: existingCount })}</p>
              <p>{t('import.selectMode')}</p>
              <div className="space-y-2">
                <div className="border rounded p-3 bg-yellow-50/50">
                  <p className="font-medium text-sm">{t('import.merge')} (Merge)</p>
                  <p className="text-xs text-muted-foreground">{t('import.specMergeDesc')}</p>
                </div>
                <div className="border rounded p-3 bg-destructive/5">
                  <p className="font-medium text-sm text-destructive">{t('import.overwrite')} (Overwrite)</p>
                  <p className="text-xs text-destructive">⚠ {t('import.specOverwriteDesc')}</p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <Button variant="outline" onClick={() => doImport("merge")} className="gap-1.5">{t('import.merge')}</Button>
            <Button variant="destructive" onClick={() => doImport("overwrite")} className="gap-1.5">{t('import.overwrite')}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Result */}
      {importResult && (
        <div className="bg-success-soft border border-success-border rounded-lg p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-success mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">{t('import.success')}</p>
              <p className="text-sm text-success">{t('import.specImportSuccess', { count: importResult.modelCount })}</p>
              {importResult.sets && importResult.sets.length > 1 && (
                <div className="mt-2 space-y-0.5">
                  {importResult.sets.map((s, i) => (
                    <p key={i} className="text-xs text-success/80">· {s.name}: {s.modelCount} {t('techSpecs.models')}</p>
                  ))}
                </div>
              )}
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

      {/* Spec Import History */}
      <SpecImportHistory />
    </>
  );
}
