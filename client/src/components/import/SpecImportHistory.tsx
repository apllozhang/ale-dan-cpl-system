import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Loader2, Search, X, Download, Trash2, History,
} from "lucide-react";
import { useTableFeatures, type ColumnDef } from "@/hooks/useTableFeatures";
import TablePagination from "@/components/TablePagination";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface ImportGroup {
  id: string;
  fileName: string;
  createdAt: Date | string;
  sheetNames: string[];
  totalProducts: number;
  setIds: number[];
}

export function SpecImportHistory() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [clearOpen, setClearOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState<ImportGroup | null>(null);

  useEffect(() => { setPage(1); }, [pageSize]);

  const columns: ColumnDef[] = [
    { key: "createdAt", label: t('import.time'), defaultWidth: 160, sortable: true },
    { key: "fileName", label: t('import.fileName', { defaultValue: '文件名' }), defaultWidth: 220, sortable: true },
    { key: "sheets", label: t('import.sheetNames', { defaultValue: '表格' }), defaultWidth: 300, sortable: false },
    { key: "totalProducts", label: t('import.productCount'), defaultWidth: 80, sortable: true },
    { key: "actions", label: "", defaultWidth: 60, sortable: false },
  ];
  const { renderHeader, renderCell, sortData } = useTableFeatures(columns);

  // Load all sets (no pagination — we group client-side)
  const setsQuery = trpc.productSpecs.listSets.useQuery({ page: 1, pageSize: 100 });
  const deleteMutation = trpc.productSpecs.deleteSet.useMutation({
    onSuccess: () => { setsQuery.refetch(); },
    onError: (err: any) => toast.error(err.message),
  });

  const allSets = setsQuery.data?.items ?? [];

  // Group sets by fileName
  const groups: ImportGroup[] = useMemo(() => {
    const map = new Map<string, ImportGroup>();
    for (const s of allSets) {
      const key = s.fileName || s.name;
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          fileName: s.fileName || s.name,
          createdAt: s.createdAt,
          sheetNames: [s.name],
          totalProducts: s.modelCount,
          setIds: [s.id],
        });
      } else {
        const g = map.get(key)!;
        g.sheetNames.push(s.name);
        g.totalProducts += s.modelCount;
        g.setIds.push(s.id);
        // Use earliest createdAt
        if (new Date(s.createdAt) < new Date(g.createdAt)) g.createdAt = s.createdAt;
      }
    }
    return Array.from(map.values());
  }, [allSets]);

  // Filter by search
  const filtered = useMemo(() => {
    if (!search) return groups;
    const q = search.toLowerCase();
    return groups.filter(g =>
      g.fileName.toLowerCase().includes(q) ||
      g.sheetNames.some(n => n.toLowerCase().includes(q))
    );
  }, [groups, search]);

  const total = filtered.length;
  const totalPages = Math.ceil(total / pageSize);
  const sortedGroups = sortData(filtered);
  const paginatedGroups = sortedGroups.slice((page - 1) * pageSize, page * pageSize);

  const handleDeleteGroup = async (group: ImportGroup) => {
    for (const id of group.setIds) {
      await deleteMutation.mutateAsync({ id });
    }
    setsQuery.refetch();
    setDeleteOpen(null);
  };

  const handleClearAll = async () => {
    for (const s of allSets) {
      await deleteMutation.mutateAsync({ id: s.id });
    }
    setsQuery.refetch();
    setClearOpen(false);
  };

  const handleExport = () => {
    const header = `${t('import.time')},${t('import.fileName', { defaultValue: '文件名' })},${t('import.sheetNames', { defaultValue: '表格' })},${t('import.productCount')}`;
    const rows = groups.map(g =>
      `"${new Date(g.createdAt).toLocaleString()}","${g.fileName.replace(/"/g, '""')}","${g.sheetNames.join(", ")}",${g.totalProducts}`
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${t('import.specHistory')}_${new Date().toISOString().split("T")[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">{t('import.specHistory')}</h2>
          <Badge variant="secondary" className="font-normal text-xs">{t('import.fileCount', { count: groups.length, defaultValue: `${groups.length} 个文件` })}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder={t('import.searchPlaceholder')} value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-8 h-8 text-xs w-52" />
            {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="w-3 h-3 text-muted-foreground" /></button>}
          </div>
          <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={handleExport} disabled={groups.length === 0}><Download className="w-3.5 h-3.5" />{t('common.export')}</Button>
          <Button variant="outline" size="sm" className="h-8 gap-1 text-xs text-destructive" onClick={() => setClearOpen(true)} disabled={allSets.length === 0}><Trash2 className="w-3.5 h-3.5" />{t('common.clear')}</Button>
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
            {setsQuery.isLoading ? (
              <tr><td colSpan={5} className="h-24 text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" /></td></tr>
            ) : paginatedGroups.length === 0 ? (
              <tr><td colSpan={5} className="h-24 text-center text-muted-foreground text-sm">{t('import.noHistory')}</td></tr>
            ) : paginatedGroups.map((g) => (
              <tr key={g.id} className="hover:bg-accent/30 border-b border-border/40">
                {renderCell(columns[0], false, <span className="text-muted-foreground">{new Date(g.createdAt).toLocaleDateString()}<br/>{new Date(g.createdAt).toLocaleTimeString()}</span>)}
                {renderCell(columns[1], false, <span className="font-medium">{g.fileName}</span>)}
                {renderCell(columns[2], false,
                  <div className="flex flex-wrap gap-1">
                    {g.sheetNames.map(name => (
                      <Badge key={name} variant="outline" className="text-xs font-normal">{name}</Badge>
                    ))}
                  </div>
                )}
                {renderCell(columns[3], false, <span className="text-center">{g.totalProducts}</span>)}
                {renderCell(columns[4], true,
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteOpen(g)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
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

      {/* Delete single group */}
      <AlertDialog open={deleteOpen !== null} onOpenChange={() => setDeleteOpen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('techSpecs.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteOpen && (
                <span>{t('techSpecs.confirmDeleteGroupDesc', { defaultValue: `确定要删除文件 "${deleteOpen.fileName}" 的所有参数集吗？包含 ${deleteOpen.sheetNames.length} 个表格，共 ${deleteOpen.totalProducts} 条记录。` })}</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteOpen && handleDeleteGroup(deleteOpen)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t('common.delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear all */}
      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('import.confirmClearHistory')}</AlertDialogTitle>
            <AlertDialogDescription>{t('import.clearHistoryWarning')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t('common.confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
