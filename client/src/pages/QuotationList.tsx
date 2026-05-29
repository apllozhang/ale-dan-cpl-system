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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import EmptyState from "@/components/EmptyState";
import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import {
  Search, Plus, Loader2, FileSpreadsheet, X,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, GitCompare,
  Trash2, ChevronDown,
} from "lucide-react";
import { QUOTATION_STATUS_LABELS, QUOTATION_STATUS_COLORS } from "@shared/const";
import QuotationCompare from "@/components/QuotationCompare";
import { useTranslation } from "react-i18next";
import { useStaggerIn } from "@/hooks/useStaggerIn";

import { useMobilePreview } from "@/contexts/MobilePreviewContext";

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
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchTimer, setSearchTimer] = useState<NodeJS.Timeout | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const isMobilePreview = useMobilePreview();
  const [showCompare, setShowCompare] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);

  const batchStatusMutation = trpc.quotations.batchUpdateStatus.useMutation({
    onSuccess: () => { quotationsQuery.refetch(); setSelectedIds(new Set()); },
  });
  const batchDeleteMutation = trpc.quotations.batchDelete.useMutation({
    onSuccess: () => { quotationsQuery.refetch(); setSelectedIds(new Set()); },
  });

  const STATUS_OPTIONS = [
    { value: "all", label: t("common.all") },
    { value: "draft", label: t("quotation.draft") },
    { value: "submitted", label: t("quotation.submitted") },
    { value: "approved", label: t("quotation.approved") },
    { value: "sent", label: t("quotation.sent") },
    { value: "completed", label: t("quotation.completed") },
    { value: "cancelled", label: t("quotation.cancelled") },
  ];

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (searchTimer) clearTimeout(searchTimer);
    const timer = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
      setSelectedIds(new Set());
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
  const tableRef = useStaggerIn<HTMLTableSectionElement>(items.length > 0 && !quotationsQuery.isLoading);

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header */}
      <div className={`flex items-center justify-between gap-4 ${isMobilePreview ? "" : "flex-wrap"}`}>
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold text-foreground">{t("quotation.title")}</h1>
          {total > 0 && (
            <Badge variant="secondary" className="font-normal text-xs">
              {t("quotation.records", { count: total })}
            </Badge>
          )}
        </div>
        <div className={`flex items-center gap-2 ${isMobilePreview ? "w-full flex-wrap" : ""}`}>
          <div className={`relative ${isMobilePreview ? "flex-1 min-w-0" : ""}`}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t("quotation.searchPlaceholder")}
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              className={`pl-9 h-9 text-sm bg-background ${isMobilePreview ? "w-full" : "w-64"}`}
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
            {t("quotation.newQuotation")}
          </Button>
          {selectedIds.size >= 2 && (
            <Button size="sm" variant="outline" onClick={() => setShowCompare(true)} className="gap-1.5">
              <GitCompare className="w-4 h-4" />
              {t("quotation.compare", { count: selectedIds.size })}
            </Button>
          )}
          {selectedIds.size >= 1 && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1.5" disabled={batchLoading}>
                    {batchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronDown className="w-4 h-4" />}
                    {t("quotation.batchStatus")}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => { batchStatusMutation.mutate({ ids: Array.from(selectedIds), status: "submitted" }); }}>
                    {QUOTATION_STATUS_LABELS.submitted}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { batchStatusMutation.mutate({ ids: Array.from(selectedIds), status: "approved" }); }}>
                    {QUOTATION_STATUS_LABELS.approved}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { batchStatusMutation.mutate({ ids: Array.from(selectedIds), status: "cancelled" }); }}>
                    {QUOTATION_STATUS_LABELS.cancelled}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button size="sm" variant="outline" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => setDeleteDialogOpen(true)}>
                <Trash2 className="w-4 h-4" />
                {t("quotation.batchDelete", { count: selectedIds.size })}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 border rounded-lg bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="text-xs font-semibold w-10">
                <input
                  type="checkbox"
                  checked={items.length > 0 && items.every((q: any) => selectedIds.has(q.id))}
                  onChange={() => {
                    setSelectedIds(prev => {
                      const next = new Set(prev);
                      if (items.every((q: any) => next.has(q.id))) {
                        items.forEach((q: any) => next.delete(q.id));
                      } else {
                        items.forEach((q: any) => next.add(q.id));
                      }
                      return next;
                    });
                  }}
                  className="w-4 h-4 cursor-pointer"
                />
              </TableHead>
              <TableHead className="text-xs font-semibold">{t("quotation.no")}</TableHead>
              <TableHead className="text-xs font-semibold">{t("quotation.customerName")}</TableHead>
              <TableHead className="text-xs font-semibold">{t("quotation.projectName")}</TableHead>
              <TableHead className="text-xs font-semibold">{t("quotation.status")}</TableHead>
              <TableHead className="text-xs font-semibold text-right">{t("quotation.amount")}</TableHead>
              <TableHead className="text-xs font-semibold">{t("quotation.createdBy")}</TableHead>
              <TableHead className="text-xs font-semibold">{t("quotation.createDate")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody ref={tableRef}>
            {quotationsQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-48 text-center">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">{t("common.loading")}</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-48 text-center">
                  <EmptyState
                    icon={FileSpreadsheet}
                    title={t("quotation.noQuotations")}
                    action={{ label: t("quotation.createFirst"), onClick: () => setLocation("/quotations/new") }}
                  />
                </TableCell>
              </TableRow>
            ) : (
              items.map((q: any) => (
                <TableRow
                  key={q.id}
                  className="stagger-child cursor-pointer hover:bg-accent/30 transition-colors"
                  onClick={() => setLocation(`/quotations/${q.id}`)}
                >
                  <TableCell onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(q.id)}
                      onChange={() => {
                        setSelectedIds(prev => {
                          const next = new Set(prev);
                          if (next.has(q.id)) next.delete(q.id);
                          else next.add(q.id);
                          return next;
                        });
                      }}
                      className="w-4 h-4 cursor-pointer"
                    />
                  </TableCell>
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
            <span>{t("data.perPage")}</span>
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
            <span>{t("data.items")}</span>
            <span className="ml-2 text-xs">
              {t("data.range", {
                start: (page - 1) * pageSize + 1,
                end: Math.min(page * pageSize, total),
                total: total.toLocaleString(),
              })}
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

      {/* Compare Dialog */}
      {showCompare && selectedIds.size >= 2 && (
        <QuotationCompare
          quotationIds={Array.from(selectedIds)}
          onClose={() => setShowCompare(false)}
        />
      )}

      {/* Batch Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("quotation.batchDeleteConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("quotation.batchDeleteWarning", { count: selectedIds.size })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                batchDeleteMutation.mutate({ ids: Array.from(selectedIds) });
                setDeleteDialogOpen(false);
              }}
            >
              {t("common.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
