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

export default function Import() {
  const { user } = useAuth();

  if (user && !user.isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Shield className="w-12 h-12 text-muted-foreground/30" />
        <p className="text-sm font-medium text-foreground">无权限访问</p>
        <p className="text-xs text-muted-foreground">仅超级管理员可导入数据</p>
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
      toast.success("数据导入成功");
      utils.cpl.sheets.invalidate();
      utils.cpl.products.invalidate();
      utils.cpl.summary.invalidate();
      utils.cpl.hasData.invalidate();
      utils.importLogs.list.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "导入失败，请重试");
    },
  });

  const handleFileSelect = (f: File) => {
    if (!f.name.endsWith(".xlsx") && !f.name.endsWith(".xls")) {
      toast.error("请选择 .xlsx 或 .xls 格式的文件"); return;
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

  const modeLabel = (m: string) => m === "overwrite" ? "完全覆盖" : m === "merge" ? "合并" : m;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <HardDriveUpload className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold text-foreground">数据导入</h1>
      </div>

      {/* Info */}
      <div className="bg-card border rounded-lg p-5 space-y-2">
        <h3 className="text-sm font-medium text-foreground">导入说明</h3>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>· 支持 .xlsx 格式的 CPL 数据文件</li>
          <li>· 若已有数据，可选择<b className="text-foreground">合并</b>（追加新数据）或<b className="text-foreground">完全覆盖</b>（清空旧数据）</li>
          <li>· 导入过程可能需要几秒钟，请耐心等待</li>
        </ul>
      </div>

      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-10 text-center transition-all cursor-pointer ${
          isDragging ? "border-primary bg-primary/5" : file ? "border-emerald-300 bg-emerald-50/50" : "border-border hover:border-primary/40 hover:bg-accent/30"
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
        {file ? (
          <div className="flex flex-col items-center gap-3">
            <FileSpreadsheet className="w-10 h-10 text-emerald-500" />
            <p className="text-sm font-medium text-foreground">{file.name}</p>
            <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB · 点击更换文件</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Upload className="w-10 h-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">拖拽文件到此处，或点击选择</p>
            <p className="text-xs text-muted-foreground">支持 .xlsx 格式</p>
          </div>
        )}
      </div>

      {/* Import button */}
      {file && (
        <div className="flex gap-2">
          <Button onClick={handleStartImport} disabled={importMutation.isPending} className="flex-1 h-11 gap-2 shadow-sm">
            {importMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />导入中...</> : <><Upload className="w-4 h-4" />开始导入</>}
          </Button>
          <Button variant="outline" onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} disabled={importMutation.isPending} className="h-11 gap-2">
            <X className="w-4 h-4" />取消导入
          </Button>
        </div>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认导入方式</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p className="text-destructive font-medium">当前已有 {existingCount} 条产品数据。</p>
              <p>请选择导入方式：</p>
              <div className="space-y-2">
                <div className="border rounded p-3 bg-yellow-50/50">
                  <p className="font-medium text-sm">合并 (Merge)</p>
                  <p className="text-xs text-muted-foreground">新数据追加到现有数据中，不会删除已有数据。同名 Sheet 会更新。</p>
                </div>
                <div className="border rounded p-3 bg-red-50/50">
                  <p className="font-medium text-sm text-red-700">完全覆盖 (Overwrite)</p>
                  <p className="text-xs text-red-600">⚠ 将清除所有现有数据，仅保留本次导入的数据。此操作不可撤销。</p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <Button variant="outline" onClick={() => doImport("merge")} className="gap-1.5">合并</Button>
            <Button variant="destructive" onClick={() => doImport("overwrite")} className="gap-1.5">完全覆盖</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Result */}
      {importResult && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-medium text-emerald-800">导入成功</p>
              <div className="text-sm text-emerald-700 space-y-1">
                <p>· 导入产品系列: {importResult.sheetsImported} 个</p>
                <p>· 导入产品数据: {importResult.productsImported} 条</p>
                <p>· 变更记录: {importResult.hasSummary ? "已更新" : "无"}</p>
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
              <p className="text-sm font-medium text-destructive">导入失败</p>
              <p className="text-sm text-destructive/80 mt-1">{importMutation.error?.message || "请检查文件格式后重试"}</p>
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
    toast.success("历史记录已清除");
    setClearOpen(false);
    utils.importLogs.list.invalidate();
  };

  const handleExport = async () => {
    const result = await utils.importLogs.export.fetch();
    if (result) {
      const blob = new Blob(["﻿" + result], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `导入记录_${new Date().toISOString().split("T")[0]}.csv`; a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">导入历史记录</h2>
          <Badge variant="secondary" className="font-normal text-xs">{total} 条</Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="搜索文件名、用户..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-8 h-8 text-xs w-52" />
            {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="w-3 h-3 text-muted-foreground" /></button>}
          </div>
          <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={handleExport}><Download className="w-3.5 h-3.5" />导出</Button>
          <Button variant="outline" size="sm" className="h-8 gap-1 text-xs text-destructive" onClick={() => setClearOpen(true)} disabled={total === 0}><Trash2 className="w-3.5 h-3.5" />清除</Button>
        </div>
      </div>

      <div className="border rounded-lg bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="text-xs font-semibold">时间</TableHead>
              <TableHead className="text-xs font-semibold">文件名</TableHead>
              <TableHead className="text-xs font-semibold">用户</TableHead>
              <TableHead className="text-xs font-semibold">组织</TableHead>
              <TableHead className="text-xs font-semibold">用户组</TableHead>
              <TableHead className="text-xs font-semibold">模式</TableHead>
              <TableHead className="text-xs font-semibold">Sheet</TableHead>
              <TableHead className="text-xs font-semibold">产品</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logsQuery.isLoading ? (
              <TableRow><TableCell colSpan={8} className="h-24 text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
            ) : logs.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground text-sm">暂无导入记录</TableCell></TableRow>
            ) : logs.map((l: any) => (
              <TableRow key={l.id} className="hover:bg-accent/30">
                <TableCell className="text-xs whitespace-nowrap">{new Date(l.createdAt).toLocaleString("zh-CN")}</TableCell>
                <TableCell className="text-xs max-w-[180px] truncate" title={l.fileName}>{l.fileName}</TableCell>
                <TableCell className="text-xs">{l.username}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{l.orgName || "-"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{l.groupName || "-"}</TableCell>
                <TableCell><Badge variant={l.mode === "overwrite" ? "destructive" : "secondary"} className="text-[10px] h-5 px-1.5">{modeLabel(l.mode)}</Badge></TableCell>
                <TableCell className="text-xs text-center">{l.sheetsCount}</TableCell>
                <TableCell className="text-xs text-center">{l.productsCount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">第 {page} / {totalPages} 页</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page === 1} onClick={() => setPage(1)}>首页</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page === 1} onClick={() => setPage(p => p - 1)}>上一页</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>下一页</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>末页</Button>
          </div>
        </div>
      )}

      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认清除历史记录</AlertDialogTitle>
            <AlertDialogDescription>清除后将删除所有导入历史记录，此操作不可恢复。确定要继续吗？</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleClear} className="bg-destructive text-destructive-foreground">确认清除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function modeLabel(m: string) { return m === "overwrite" ? "完全覆盖" : m === "merge" ? "合并" : m; }
