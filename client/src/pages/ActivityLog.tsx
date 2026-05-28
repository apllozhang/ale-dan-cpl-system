import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import EmptyState from "@/components/EmptyState";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState, useMemo, useRef, useCallback } from "react";

declare global {
  interface Window {
    showSaveFilePicker?: (options?: {
      suggestedName?: string;
      types?: { description: string; accept: Record<string, string[]> }[];
    }) => Promise<FileSystemFileHandle>;
  }
  interface FileSystemFileHandle {
    createWritable(): Promise<FileSystemWritableFileStream>;
  }
  interface FileSystemWritableFileStream extends WritableStream {
    write(data: any): Promise<void>;
    close(): Promise<void>;
  }
}
import {
  Activity, Users, FileText, Search, Loader2, Trash2, Download,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useStaggerIn } from "@/hooks/useStaggerIn";

function formatDetail(action: string, detail: string | null, t: (key: string, options?: Record<string, any>) => string): string {
  if (!detail) return "-";
  try {
    const d = JSON.parse(detail);
    switch (action) {
      case "login":
        return t('activity.actionLogin');
      case "logout":
        return t('activity.actionLogout');
      case "create_quotation":
        return t('activity.createQuotationDetail', { no: d.quotationNo || "", customer: d.customerName || "", count: d.itemCount ?? 0 });
      case "update_quotation":
        return t('activity.updateQuotationDetail', { no: d.quotationNo || "" });
      case "delete_quotation":
        return t('activity.deleteQuotationDetail', { no: d.quotationNo || "", customer: d.customerName || "" });
      case "update_status":
        return t('activity.updateStatusDetail', { no: d.quotationNo || "", status: d.newStatus || "", count: d.count });
      case "import_data":
        return t('activity.importDataDetail', { fileName: d.fileName || "", sheets: d.sheetsCount ?? 0, products: d.productsCount ?? 0 });
      case "create_user":
        return t('activity.createUserDetail', { username: d.username || "", role: d.role || "" });
      case "update_user": {
        const changes = d.changes ? `，变更：${d.changes}` : "";
        return t('activity.updateUserDetail', { username: d.username || "", changes });
      }
      case "delete_user":
        return t('activity.deleteUserDetail', { username: d.username || "" });
      case "create_organization":
        return t('activity.createOrganizationDetail', { name: d.name || "" });
      case "update_organization":
        return t('activity.updateOrganizationDetail', { name: d.name || "" });
      case "delete_organization":
        return t('activity.deleteOrganizationDetail', { id: d.id ?? "" });
      default:
        return Object.entries(d).map(([k, v]) => `${k}: ${v}`).join("，");
    }
  } catch {
    return detail.slice(0, 120);
  }
}

const ACTION_COLORS: Record<string, string> = {
  login: "bg-green-50 text-green-700",
  logout: "bg-gray-50 text-gray-600",
  create_quotation: "bg-blue-50 text-blue-700",
  update_quotation: "bg-amber-50 text-amber-700",
  delete_quotation: "bg-red-50 text-red-700",
  update_status: "bg-purple-50 text-purple-700",
  import_data: "bg-indigo-50 text-indigo-700",
  create_user: "bg-teal-50 text-teal-700",
  update_user: "bg-orange-50 text-orange-700",
  delete_user: "bg-red-50 text-red-600",
  create_organization: "bg-cyan-50 text-cyan-700",
  update_organization: "bg-cyan-50 text-cyan-700",
  delete_organization: "bg-red-50 text-red-600",
};

const RESOURCE_COLORS: Record<string, string> = {
  auth: "bg-gray-50 text-gray-600",
  quotation: "bg-blue-50 text-blue-600",
  user: "bg-teal-50 text-teal-600",
  import: "bg-indigo-50 text-indigo-600",
  organization: "bg-cyan-50 text-cyan-600",
};

export default function ActivityLog() {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [resourceTypeFilter, setResourceTypeFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [page, setPage] = useState(1);
  const [clearOpen, setClearOpen] = useState(false);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 300);
  }, []);
  const pageSize = 20;

  const dateParams = useMemo(() => {
    if (dateRange === "today") {
      return { startDate: new Date().toISOString().split("T")[0] };
    }
    if (dateRange === "7days") {
      const d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return { startDate: d.toISOString().split("T")[0] };
    }
    if (dateRange === "30days") {
      const d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      return { startDate: d.toISOString().split("T")[0] };
    }
    if (dateRange === "custom" && (customStart || customEnd)) {
      return { startDate: customStart || undefined, endDate: customEnd || undefined };
    }
    return {};
  }, [dateRange, customStart, customEnd]);

  const RESOURCE_LABELS: Record<string, string> = useMemo(() => ({
    quotation: t('activity.resQuotation'),
    user: t('activity.resUser'),
    import: t('activity.resImport'),
    product: t('activity.resProduct'),
    auth: t('activity.resAuth'),
    organization: t('activity.resOrganization'),
  }), [t]);

  const ACTION_LABELS: Record<string, string> = useMemo(() => ({
    login: t('activity.actionLogin'),
    logout: t('activity.actionLogout'),
    create_quotation: t('activity.actionCreateQuotation'),
    update_quotation: t('activity.actionUpdateQuotation'),
    delete_quotation: t('activity.actionDeleteQuotation'),
    update_status: t('activity.actionUpdateStatus'),
    import_data: t('activity.actionImportData'),
    create_user: t('activity.actionCreateUser'),
    update_user: t('activity.actionUpdateUser'),
    delete_user: t('activity.actionDeleteUser'),
    create_organization: t('activity.actionCreateOrganization'),
    update_organization: t('activity.actionUpdateOrganization'),
    delete_organization: t('activity.actionDeleteOrganization'),
  }), [t]);

  const DATE_OPTIONS = useMemo(() => [
    { value: "all", label: t('activity.allDates') },
    { value: "today", label: t('activity.today') },
    { value: "7days", label: t('activity.last7days') },
    { value: "30days", label: t('activity.last30days') },
    { value: "custom", label: t('activity.customRange') },
  ], [t]);

  const { data: stats } = trpc.activityLogs.stats.useQuery();
  const { data, isLoading, refetch } = trpc.activityLogs.list.useQuery({
    search: debouncedSearch || undefined,
    action: actionFilter !== "all" ? actionFilter : undefined,
    resourceType: resourceTypeFilter !== "all" ? resourceTypeFilter : undefined,
    ...dateParams,
    page,
    pageSize,
  });

  const clearMutation = trpc.activityLogs.clear.useMutation({
    onSuccess: () => { toast.success(t('activity.logsCleared')); refetch(); },
    onError: (err: any) => toast.error(err.message || t('activity.clearFailed')),
  });

  const handleExport = async () => {
    try {
      const result = await utils.activityLogs.export.fetch({
        search: debouncedSearch || undefined,
        action: actionFilter !== "all" ? actionFilter : undefined,
        resourceType: resourceTypeFilter !== "all" ? resourceTypeFilter : undefined,
        ...dateParams,
      });
      if (!result) return;
      const csvContent = "﻿" + result;
      const suggestedName = `activity_log_${new Date().toISOString().split("T")[0]}.csv`;

      if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({
          suggestedName,
          types: [{ description: "CSV", accept: { "text/csv": [".csv"] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(new Blob([csvContent], { type: "text/csv;charset=utf-8" }));
        await writable.close();
      } else {
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = suggestedName;
        a.click();
        URL.revokeObjectURL(url);
      }
      toast.success(t('activity.exportSuccess'));
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      toast.error(t('activity.exportFailed'));
    }
  };

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;
  const tableRef = useStaggerIn<HTMLTableSectionElement>(!!data?.items?.length && !isLoading);

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Activity className="w-5 h-5" />
          {t('activity.title')}
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-3.5 h-3.5 mr-1" />
            {t('activity.exportLogs')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setClearOpen(true)} disabled={clearMutation.isPending} className="text-destructive hover:text-destructive">
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            {t('activity.clearLogs')}
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50 text-green-600">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xl font-bold tabular-nums">{stats?.today ?? 0}</div>
                <p className="text-xs text-muted-foreground">{t('activity.todayOps')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xl font-bold tabular-nums">{stats?.week ?? 0}</div>
                <p className="text-xs text-muted-foreground">{t('activity.weekOps')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xl font-bold tabular-nums">{stats?.byAction?.login ?? 0}</div>
                <p className="text-xs text-muted-foreground">{t('activity.weekLogins')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder={t('activity.searchPlaceholder')}
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            className="pl-9 h-9 text-sm w-64 bg-background"
          />
        </div>
        <Select value={actionFilter} onValueChange={v => { setActionFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[140px] h-9 text-sm">
            <SelectValue placeholder={t('activity.actionType')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('activity.allActions')}</SelectItem>
            {Object.entries(ACTION_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={resourceTypeFilter} onValueChange={v => { setResourceTypeFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[120px] h-9 text-sm">
            <SelectValue placeholder={t('activity.resourceType')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('activity.allResourceTypes')}</SelectItem>
            <SelectItem value="quotation">{t('activity.resQuotation')}</SelectItem>
            <SelectItem value="user">{t('activity.resUser')}</SelectItem>
            <SelectItem value="import">{t('activity.resImport')}</SelectItem>
            <SelectItem value="auth">{t('activity.resAuth')}</SelectItem>
            <SelectItem value="organization">{t('activity.resOrganization')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={dateRange} onValueChange={v => { setDateRange(v); setPage(1); }}>
          <SelectTrigger className="w-[120px] h-9 text-sm">
            <SelectValue placeholder={t('activity.dateRange')} />
          </SelectTrigger>
          <SelectContent>
            {DATE_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {dateRange === "custom" && (
          <div className="flex items-center gap-1">
            <Input type="date" value={customStart} onChange={e => { setCustomStart(e.target.value); setPage(1); }}
              className="h-9 w-[130px] text-xs" placeholder={t('activity.startDate')} />
            <span className="text-xs text-muted-foreground">~</span>
            <Input type="date" value={customEnd} onChange={e => { setCustomEnd(e.target.value); setPage(1); }}
              className="h-9 w-[130px] text-xs" placeholder={t('activity.endDate')} />
          </div>
        )}
      </div>

      {/* Log table */}
      <Card className="flex-1 overflow-hidden">
        <div className="overflow-auto h-full">
          <table className="w-full" style={{ tableLayout: "fixed" }}>
            <thead>
              <tr className="bg-muted/30 border-b">
                <th className="text-xs font-semibold px-4 py-2.5 text-left w-[160px]">{t('activity.time')}</th>
                <th className="text-xs font-semibold px-4 py-2.5 text-left w-[100px]">{t('activity.user')}</th>
                <th className="text-xs font-semibold px-4 py-2.5 text-left w-[120px]">{t('activity.action')}</th>
                <th className="text-xs font-semibold px-4 py-2.5 text-left w-[90px]">{t('activity.resourceType')}</th>
                <th className="text-xs font-semibold px-4 py-2.5 text-left">{t('activity.detail')}</th>
              </tr>
            </thead>
            <tbody ref={tableRef}>
              {isLoading ? (
                <tr><td colSpan={5} className="h-32 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></td></tr>
              ) : !data?.items?.length ? (
                <tr><td colSpan={5}>
                  <EmptyState icon={Activity} title={t('activity.noLogs')} />
                </td></tr>
              ) : data.items.map((log: any) => (
                <tr key={log.id} className="stagger-child border-b border-border/50 hover:bg-accent/30">
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString("zh-CN")}
                  </td>
                  <td className="px-4 py-2 text-xs font-medium">{log.username || "-"}</td>
                  <td className="px-4 py-2">
                    <Badge variant="outline" className={`text-[10px] h-5 px-1.5 ${ACTION_COLORS[log.action] || ""}`}>
                      {ACTION_LABELS[log.action] || log.action}
                    </Badge>
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant="outline" className={`text-[10px] h-5 px-1.5 ${RESOURCE_COLORS[log.resourceType] || "bg-slate-50 text-slate-600"}`}>
                      {RESOURCE_LABELS[log.resourceType] || log.resourceType || "-"}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground" style={{ maxWidth: 400 }}>
                    {formatDetail(log.action, log.detail, t)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{t('activity.totalRecords', { count: data?.total ?? 0 })}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="h-7 text-xs">{t('common.previous')}</Button>
            <span>{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="h-7 text-xs">{t('common.next')}</Button>
          </div>
        </div>
      )}

      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('activity.confirmClear')}</AlertDialogTitle>
            <AlertDialogDescription>{t('activity.clearWarning')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { clearMutation.mutate(); setClearOpen(false); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t('activity.confirmClearBtn')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
