import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import {
  Search, Plus, Loader2, FileSpreadsheet, X,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
} from "lucide-react";
import { QUOTATION_STATUS_LABELS, QUOTATION_STATUS_COLORS } from "@shared/const";

const STATUS_OPTIONS = [
  { value: "all", label: "全部状态" },
  { value: "draft", label: "草稿" },
  { value: "submitted", label: "已提交" },
  { value: "approved", label: "已审批" },
  { value: "sent", label: "已发送" },
  { value: "completed", label: "已完成" },
  { value: "cancelled", label: "已取消" },
];

function generatePageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [];
  if (current <= 4) {
    for (let i = 1; i <= 5; i++) pages.push(i);
    pages.push("...", total);
  } else if (current >= total - 3) {
    pages.push(1, "...");
    for (let i = total - 4; i <= total; i++) pages.push(i);
  } else {
    pages.push(1, "...", current - 1, current, current + 1, "...", total);
  }
  return pages;
}

export default function QuotationList() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchTimer, setSearchTimer] = useState<NodeJS.Timeout | null>(null);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (searchTimer) clearTimeout(searchTimer);
    const timer = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 300);
    setSearchTimer(timer);
  }, [searchTimer]);

  const quotationsQuery = trpc.quotations.list.useQuery({
    search: debouncedSearch || undefined,
    status: status === "all" ? undefined : status,
    page,
    pageSize,
  });

  const items = quotationsQuery.data?.items ?? [];
  const total = quotationsQuery.data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold text-foreground">报价管理</h1>
          {total > 0 && (
            <Badge variant="secondary" className="font-normal text-xs">
              {total.toLocaleString()} 条记录
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="搜索报价单号、客户、项目..."
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              className="pl-9 w-64 h-9 text-sm bg-background"
            />
            {search && (
              <button
                onClick={() => { setSearch(""); setDebouncedSearch(""); setPage(1); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <Select value={status} onValueChange={v => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-32 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => setLocation("/quotations/new")} className="gap-1.5">
            <Plus className="w-4 h-4" />
            新建报价
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 border rounded-lg bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="text-xs font-semibold">报价编号</TableHead>
              <TableHead className="text-xs font-semibold">客户名称</TableHead>
              <TableHead className="text-xs font-semibold">项目名称</TableHead>
              <TableHead className="text-xs font-semibold">状态</TableHead>
              <TableHead className="text-xs font-semibold text-right">金额</TableHead>
              <TableHead className="text-xs font-semibold">创建人</TableHead>
              <TableHead className="text-xs font-semibold">创建日期</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotationsQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-48 text-center">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">加载中...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-48 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <FileSpreadsheet className="w-8 h-8 opacity-30" />
                    <span className="text-sm">暂无报价单</span>
                    <button
                      onClick={() => setLocation("/quotations/new")}
                      className="text-xs text-primary hover:text-primary/80 font-medium"
                    >
                      创建第一份报价单 →
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              items.map((q: any) => (
                <TableRow
                  key={q.id}
                  onClick={() => setLocation(`/quotations/${q.id}`)}
                  className="cursor-pointer hover:bg-accent/30 transition-colors"
                >
                  <TableCell className="text-sm font-medium text-primary">{q.quotationNo}</TableCell>
                  <TableCell className="text-sm">{q.customerName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{q.projectName || "-"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] h-5 px-1.5 ${QUOTATION_STATUS_COLORS[q.status] || ""}`}>
                      {QUOTATION_STATUS_LABELS[q.status] || q.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-right font-medium tabular-nums">
                    {q.totalAmount ? `¥${Number(q.totalAmount).toLocaleString()}` : "-"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{q.creatorName || q.creatorUsername || "-"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {q.createdAt ? new Date(q.createdAt).toLocaleDateString("zh-CN") : "-"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 0 && (
        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>每页</span>
            <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setPage(1); }}>
              <SelectTrigger className="h-8 w-[70px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
            <span>条</span>
            <span className="ml-2 text-xs">
              第 {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} 条，共 {total.toLocaleString()} 条
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page <= 1} onClick={() => setPage(1)}>
              <ChevronsLeft className="w-3.5 h-3.5" />
            </Button>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <div className="flex items-center gap-1 mx-1">
              {generatePageNumbers(page, totalPages).map((p, i) =>
                p === "..." ? (
                  <span key={`ellipsis-${i}`} className="px-1 text-xs text-muted-foreground">...</span>
                ) : (
                  <Button key={p} variant={page === p ? "default" : "outline"} size="sm" className="h-8 w-8 p-0 text-xs" onClick={() => setPage(p as number)}>
                    {p}
                  </Button>
                )
              )}
            </div>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>
              <ChevronsRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
