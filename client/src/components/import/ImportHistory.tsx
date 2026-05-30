import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Loader2, Search, X, Download, Trash2, History, RefreshCw,
} from "lucide-react";
import { useTableFeatures, type ColumnDef } from "@/hooks/useTableFeatures";
import TablePagination from "@/components/TablePagination";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export function ImportHistory() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [clearOpen, setClearOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState<number | null>(null);
  const [switchOpen, setSwitchOpen] = useState<number | null>(null);

  useEffect(() => { setPage(1); }, [pageSize]);

  const columns: ColumnDef[] = [
    { key: "createdAt", label: t('import.time'), defaultWidth: 160, sortable: true },
    { key: "fileName", label: t('import.fileName', { defaultValue: '文件名' }), defaultWidth: 220, sortable: true },
    { key: "sheetNames", label: t('import.sheetNames', { defaultValue: '表格' }), defaultWidth: 280, sortable: false },
    { key: "mode", label: t('import.mode'), defaultWidth: 80, sortable: true },
    { key: "actions", label: "", defaultWidth: 120, sortable: false },
  ];
  const { renderHeader, renderCell, sortData } = useTableFeatures(columns);

  const logsQuery = trpc.importLogs.list.useQuery({ search: search || undefined, page, pageSize });
  const deleteMutation = trpc.importLogs.deleteLog.useMutation({
    onSuccess: () => { logsQuery.refetch(); },
    onError: (err: any) => toast.error(err.message),
  });
  const switchMutation = trpc.importLogs.switchActive.useMutation({
    onSuccess: () => {
      logsQuery.refetch();
      utils.cpl.products.invalidate();
      utils.cpl.sheets.invalidate();
      utils.cpl.summary.invalidate();
      utils.cpl.hasData.invalidate();
      toast.success(t('import.switchSuccess', { defaultValue: '已切换到该导入数据' }));
      setSwitchOpen(null);
    },
    onError: (err: any) => toast.error(err.message),
  });
  const clearMut = trpc.importLogs.clear.useMutation();
  const utils = trpc.useUtils();
  const logs = logsQuery.data?.items ?? [];
  const total = logsQuery.data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);
  const sortedLogs = sortData(logs);

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

      <div className="border rounded-lg bg-card overflow-auto">
        <table style={{ width: 'max-content', minWidth: '100%', tableLayout: 'fixed' }}>
          <thead>
            <tr className="bg-muted/30">
              {columns.map((col, i) => renderHeader(col, i === columns.length - 1))}
            </tr>
          </thead>
          <tbody>
            {logsQuery.isLoading ? (
              <tr><td colSpan={5} className="h-24 text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" /></td></tr>
            ) : sortedLogs.length === 0 ? (
              <tr><td colSpan={5} className="h-24 text-center text-muted-foreground text-sm">{t('import.noHistory')}</td></tr>
            ) : sortedLogs.map((l: any) => (
              <tr key={l.id} className={`hover:bg-accent/30 border-b border-border/40 ${l.isActive ? "bg-primary/5" : ""}`}>
                {renderCell(columns[0], false, <span className="text-muted-foreground">{new Date(l.createdAt).toLocaleDateString()}<br/>{new Date(l.createdAt).toLocaleTimeString()}</span>)}
                {renderCell(columns[1], false, <span className="font-medium">{l.fileName}</span>)}
                {renderCell(columns[2], false,
                  l.sheetNames?.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {l.sheetNames.map((name: string) => (
                        <Badge key={name} variant="outline" className="text-xs font-normal">{name}</Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">{t('import.sheetCount', { count: l.sheetsCount, defaultValue: `${l.sheetsCount} 个表格` })}</span>
                  )
                )}
                {renderCell(columns[3], false,
                  <Badge variant={l.mode === "overwrite" ? "destructive" : "secondary"} className="text-[10px] h-5 px-1.5">{l.mode === "overwrite" ? t('import.overwrite') : t('import.merge')}</Badge>
                )}
                {renderCell(columns[4], true,
                  <div className="flex items-center gap-1">
                    {l.isActive ? (
                      <Badge className="text-[10px] h-5 px-1.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800">
                        {t('import.currentActive', { defaultValue: '当前' })}
                      </Badge>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-[10px] gap-1"
                        onClick={() => setSwitchOpen(l.id)}
                        disabled={switchMutation.isPending}
                      >
                        <RefreshCw className="w-3 h-3" />
                        {t('import.switchTo', { defaultValue: '切换' })}
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteOpen(l.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TablePagination
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

      {/* Switch confirmation */}
      <AlertDialog open={switchOpen !== null} onOpenChange={() => setSwitchOpen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('import.confirmSwitch', { defaultValue: '确认切换导入数据' })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('import.switchWarning', { defaultValue: '切换后，产品数据页面将显示该导入的数据。当前激活的导入数据不会被删除，可随时再次切换回来。' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (switchOpen) switchMutation.mutate({ id: switchOpen }); }} className="bg-primary text-primary-foreground hover:bg-primary/90">{t('import.confirmSwitchBtn', { defaultValue: '确认切换' })}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete single log */}
      <AlertDialog open={deleteOpen !== null} onOpenChange={() => setDeleteOpen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('techSpecs.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>{t('import.confirmDeleteLogDesc', { defaultValue: '确定要删除这条导入记录吗？关联的产品数据也将被删除。' })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteOpen) deleteMutation.mutate({ id: deleteOpen }); setDeleteOpen(null); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t('common.delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
