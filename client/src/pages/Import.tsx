import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState, useRef } from "react";
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2,
  HardDriveUpload, Shield, Search, X, Download, Trash2, History, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export default function Import() {
  const { t } = useTranslation();
  const { user } = useAuth();

  if (user && !user.isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Shield className="w-12 h-12 text-muted-foreground/30" />
        <p className="text-sm font-medium text-foreground">{t('common.noPermission')}</p>
        <p className="text-xs text-muted-foreground">{t('user.superAdminOnly')}</p>
      </div>
    );
  }

  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingMode, setPendingMode] = useState<"overwrite" | "merge" | null>(null);
  const [importResult, setImportResult] = useState<{
    sheetsImported: number; productsImported: number; hasSummary: boolean;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const hasDataQuery = trpc.cpl.hasData.useQuery();
  const hasExistingData = hasDataQuery.data?.hasData ?? false;
  const existingCount = hasDataQuery.data?.count ?? 0;

  const importMutation = trpc.cpl.import.useMutation({
    onSuccess: (data) => {
      setImportResult(data);
      setFile(null);
      toast.success(t('import.importSuccess'));
      utils.cpl.sheets.invalidate();
      utils.cpl.products.invalidate();
      utils.cpl.summary.invalidate();
      utils.cpl.hasData.invalidate();
      utils.importLogs.list.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || t('import.importFailed'));
    },
  });

  const handleFileSelect = (f: File) => {
    if (!f.name.endsWith(".xlsx") && !f.name.endsWith(".xls")) {
      toast.error(t('import.selectFile')); return;
    }
    setFile(f); setImportResult(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f);
  };

  const handleStartImport = () => {
    if (!file) return;
    if (hasExistingData) {
      setConfirmOpen(true);
    } else {
      doImport("overwrite");
    }
  };

  const doImport = async (mode: "overwrite" | "merge") => {
    if (!file) return;
    setConfirmOpen(false);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      importMutation.mutate({ fileBase64: base64, fileName: file.name, mode });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <HardDriveUpload className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold text-foreground">{t('import.title')}</h1>
      </div>

      {/* Info */}
      <div className="bg-card border rounded-lg p-5 space-y-2">
        <h3 className="text-sm font-medium text-foreground">{t('import.instructions')}</h3>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>· {t('import.supportFormat')}</li>
          <li>· {t('import.mergeExplain')}</li>
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

      {/* Import button */}
      {file && (
        <div className="flex gap-2">
          <Button onClick={handleStartImport} disabled={importMutation.isPending} className="flex-1 h-11 gap-2 shadow-sm">
            {importMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />{t('import.importing')}</> : <><Upload className="w-4 h-4" />{t('import.startImport')}</>}
          </Button>
          <Button variant="outline" onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} disabled={importMutation.isPending} className="h-11 gap-2">
            <X className="w-4 h-4" />{t('import.cancelImport')}
          </Button>
        </div>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('import.confirmMode')}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p className="text-destructive font-medium">{t('import.existingData', { count: existingCount })}</p>
              <p>{t('import.selectMode')}</p>
              <div className="space-y-2">
                <div className="border rounded p-3 bg-yellow-50/50">
                  <p className="font-medium text-sm">{t('import.merge')} (Merge)</p>
                  <p className="text-xs text-muted-foreground">{t('import.mergeDesc')}</p>
                </div>
                <div className="border rounded p-3 bg-destructive/5">
                  <p className="font-medium text-sm text-destructive">{t('import.overwrite')} (Overwrite)</p>
                  <p className="text-xs text-destructive">⚠ {t('import.overwriteDesc')}</p>
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
    </div>
  );
}

// ==================== Import History ====================
function ImportHistory() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [clearOpen, setClearOpen] = useState(false);

  const logsQuery = trpc.importLogs.list.useQuery({ search: search || undefined, page, pageSize: 20 });
  const clearMut = trpc.importLogs.clear.useMutation();
  const exportQuery = trpc.importLogs.export.useQuery(undefined, { enabled: false });
  const utils = trpc.useUtils();
  const logs = logsQuery.data?.items ?? [];
  const total = logsQuery.data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  const handleClear = async () => {
    await clearMut.mutateAsync();
    toast.success(t('import.historyCleared'));
    setClearOpen(false);
    utils.importLogs.list.invalidate();
  };

  const handleExport = async () => {
    const result = await utils.importLogs.export.fetch();
    if (result) {
      const blob = new Blob(["﻿" + result], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${t('import.history')}_${new Date().toISOString().split("T")[0]}.csv`; a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">{t('import.history')}</h2>
          <Badge variant="secondary" className="font-normal text-xs">{t('common.records', { count: total })}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder={t('import.searchPlaceholder')} value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-8 h-8 text-xs w-52" />
            {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="w-3 h-3 text-muted-foreground" /></button>}
          </div>
          <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={handleExport}><Download className="w-3.5 h-3.5" />{t('common.export')}</Button>
          <Button variant="outline" size="sm" className="h-8 gap-1 text-xs text-destructive" onClick={() => setClearOpen(true)} disabled={total === 0}><Trash2 className="w-3.5 h-3.5" />{t('common.clear')}</Button>
        </div>
      </div>

      <div className="border rounded-lg bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="text-xs font-semibold">{t('import.time')}</TableHead>
              <TableHead className="text-xs font-semibold">{t('import.fileName')}</TableHead>
              <TableHead className="text-xs font-semibold">{t('import.user')}</TableHead>
              <TableHead className="text-xs font-semibold">{t('common.organization')}</TableHead>
              <TableHead className="text-xs font-semibold">{t('common.group')}</TableHead>
              <TableHead className="text-xs font-semibold">{t('import.mode')}</TableHead>
              <TableHead className="text-xs font-semibold">{t('import.sheet')}</TableHead>
              <TableHead className="text-xs font-semibold">{t('import.productCount')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logsQuery.isLoading ? (
              <TableRow><TableCell colSpan={8} className="h-24 text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
            ) : logs.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground text-sm">{t('import.noHistory')}</TableCell></TableRow>
            ) : logs.map((l: any) => (
              <TableRow key={l.id} className="hover:bg-accent/30">
                <TableCell className="text-xs whitespace-nowrap">{new Date(l.createdAt).toLocaleString("zh-CN")}</TableCell>
                <TableCell className="text-xs max-w-[180px] truncate" title={l.fileName}>{l.fileName}</TableCell>
                <TableCell className="text-xs">{l.username}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{l.orgName || "-"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{l.groupName || "-"}</TableCell>
                <TableCell><Badge variant={l.mode === "overwrite" ? "destructive" : "secondary"} className="text-[10px] h-5 px-1.5">{l.mode === "overwrite" ? t('import.overwrite') : t('import.merge')}</Badge></TableCell>
                <TableCell className="text-xs text-center">{l.sheetsCount}</TableCell>
                <TableCell className="text-xs text-center">{l.productsCount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{t('common.page', { current: page, total: totalPages })}</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page === 1} onClick={() => setPage(1)}>{t('common.first')}</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page === 1} onClick={() => setPage(p => p - 1)}>{t('common.previous')}</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>{t('common.next')}</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>{t('common.last')}</Button>
          </div>
        </div>
      )}

      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('import.confirmClearHistory')}</AlertDialogTitle>
            <AlertDialogDescription>{t('import.clearHistoryWarning')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleClear} className="bg-destructive text-destructive-foreground">{t('common.confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
