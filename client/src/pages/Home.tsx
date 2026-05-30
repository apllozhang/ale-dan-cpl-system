import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Database, FileSpreadsheet, Layers, FileText, ArrowRight, Plus, List, Loader2, ChevronsUpDown, ChevronUp, ChevronDown, GripVertical } from "lucide-react";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { QUOTATION_STATUS_LABELS, QUOTATION_STATUS_COLORS } from "@shared/const";
import gsap from "gsap";

const DATE_PRESETS = [
  { key: "thisMonth", label: "本月" },
  { key: "thisQuarter", label: "本季度" },
  { key: "thisYear", label: "本年" },
  { key: "all", label: "全部" },
] as const;

const STATUS_ORDER = ["draft", "submitted", "approved", "sent", "completed", "cancelled"] as const;

function getDateRange(preset: string) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (preset) {
    case "thisMonth":
      return { startDate: new Date(y, m, 1).toISOString().slice(0, 10), endDate: "" };
    case "thisQuarter": {
      const qStart = new Date(y, Math.floor(m / 3) * 3, 1);
      return { startDate: qStart.toISOString().slice(0, 10), endDate: "" };
    }
    case "thisYear":
      return { startDate: new Date(y, 0, 1).toISOString().slice(0, 10), endDate: "" };
    default:
      return { startDate: "", endDate: "" };
  }
}

function useStaggerIn<T extends HTMLElement>(ready: boolean) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!ready || !ref.current) return;
    const children = ref.current.querySelectorAll(".stagger-child");
    if (!children.length) return;
    gsap.fromTo(children,
      { opacity: 0, y: 16, scale: 0.97 },
      { opacity: 1, y: 0, scale: 1, stagger: 0.06, duration: 0.5, ease: "power3.out" }
    );
  }, [ready]);
  return ref;
}

function StatCard({ icon: Icon, label, value, color, loading }: {
  icon: any; label: string; value: string; color: string; loading?: boolean;
}) {
  return (
    <div className="bg-card border rounded-lg p-5 hover:shadow-md transition-all stagger-child flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center shrink-0`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0">
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        ) : (
          <p className="text-2xl font-bold tabular-nums text-foreground">{value}</p>
        )}
        <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function ResizableTh({ children, width, onResize }: {
  children: React.ReactNode; width: number; onResize: (w: number) => void;
}) {
  const thRef = useRef<HTMLTableCellElement>(null);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startX.current = e.clientX;
    startW.current = width;
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const delta = ev.clientX - startX.current;
      onResize(Math.max(50, startW.current + delta));
    };
    const onUp = () => {
      dragging.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [width, onResize]);

  return (
    <th ref={thRef} className="px-4 py-2 text-left font-semibold relative select-none group" style={{ width, minWidth: 50 }}>
      {children}
      <span
        onMouseDown={onMouseDown}
        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <span className="w-0.5 h-4 bg-primary/40 rounded-full" />
      </span>
    </th>
  );
}

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [datePreset, setDatePreset] = useState<string>("all");

  const { startDate, endDate } = useMemo(() => getDateRange(datePreset), [datePreset]);

  const sheetsQuery = trpc.cpl.sheets.useQuery();
  const summaryQuery = trpc.cpl.summary.useQuery();
  const dashboardQuery = trpc.quotations.myDashboard.useQuery({
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  const sheets: any[] = sheetsQuery.data ?? [];
  const summary = summaryQuery.data;
  const totalProducts = sheets.reduce((sum, s) => sum + s.productCount, 0);
  const stats = dashboardQuery.data?.stats;
  const recent = dashboardQuery.data?.recent ?? [];

  const today = new Date();
  const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;

  const ready = !dashboardQuery.isLoading && !!stats;
  const containerRef = useStaggerIn<HTMLDivElement>(!!ready);

  // Sortable recent table state
  const [sortKey, setSortKey] = useState<string>("updatedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const sortedRecent = useMemo(() => {
    const arr = [...recent];
    const key = sortKey as keyof (typeof arr)[0];
    arr.sort((a: any, b: any) => {
      const va = a[key] ?? "";
      const vb = b[key] ?? "";
      let cmp = 0;
      if (typeof va === "number" && typeof vb === "number") cmp = va - vb;
      else cmp = String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [recent, sortKey, sortDir]);
  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };
  const SortIcon = ({ col }: { col: string }) => {
    if (sortKey !== col) return <ChevronsUpDown className="w-3 h-3 text-muted-foreground/40" />;
    return sortDir === "asc"
      ? <ChevronUp className="w-3 h-3 text-primary" />
      : <ChevronDown className="w-3 h-3 text-primary" />;
  };

  // Resizable columns
  const defaultWidths = useMemo(() => ({ seq: 64, customer: 140, project: 140, contact: 110, status: 100, amount: 110, date: 90 }), []);
  const [colWidths, setColWidths] = useState(defaultWidths);
  const updateColWidth = useCallback((key: keyof typeof colWidths, w: number) => {
    setColWidths(prev => ({ ...prev, [key]: w }));
  }, []);

  // Status counts for merged card
  const statusCounts = (stats as any)?.statusCounts ?? {};

  return (
    <div className="space-y-6" ref={containerRef}>
      {/* Row 1: Welcome + Quick Actions */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            欢迎回来{user?.name ? `，${user.name}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">今日是 {dateStr}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setLocation("/quotations/new")}>
            <Plus className="w-4 h-4 mr-1" />
            新建报价
          </Button>
          <Button size="sm" variant="outline" onClick={() => setLocation("/quotations")}>
            <List className="w-4 h-4 mr-1" />
            查看全部
          </Button>
        </div>
      </div>

      {/* Row 2: Date Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {DATE_PRESETS.map(p => (
          <button
            key={p.key}
            onClick={() => setDatePreset(p.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              datePreset === p.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Row 3: KPI Cards — 报价数, 成交额, 报价单状态 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          icon={FileSpreadsheet}
          label="报价数"
          value={stats ? String(stats.totalQuotations) : "—"}
          color="bg-gradient-to-br from-kpi-blue to-kpi-blue/90"
          loading={dashboardQuery.isLoading}
        />
        <StatCard
          icon={Database}
          label="成交额"
          value={stats ? `¥${stats.completedRevenue.toLocaleString()}` : "—"}
          color="bg-gradient-to-br from-kpi-emerald to-kpi-emerald/90"
          loading={dashboardQuery.isLoading}
        />
        {/* Merged status card */}
        <div className="bg-card border rounded-lg p-5 hover:shadow-md transition-all stagger-child">
          {dashboardQuery.isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-3">报价单状态</p>
              <div className="grid grid-cols-3 gap-x-4 gap-y-2">
                {STATUS_ORDER.map(s => (
                  <div key={s} className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${QUOTATION_STATUS_COLORS[s]?.split(" ")[0] ?? "bg-muted"}`} />
                    <span className="text-xs text-muted-foreground">{QUOTATION_STATUS_LABELS[s]}</span>
                    <span className="text-sm font-bold tabular-nums text-foreground ml-auto">{statusCounts[s] ?? 0}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Row 4: Recent Activity + Quick Data */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Quotations */}
        <div className="lg:col-span-2 bg-card border rounded-lg overflow-hidden flex flex-col">
          <div className="px-5 py-3 bg-muted/30 border-b flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">最近动态</span>
            <button
              onClick={() => setLocation("/quotations")}
              className="text-xs text-primary hover:text-primary/80 font-medium"
            >
              查看全部 →
            </button>
          </div>
          {recent.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <FileSpreadsheet className="w-10 h-10 text-muted-foreground/30 mx-auto" />
              <p className="text-sm font-medium text-foreground mt-3">暂无报价记录</p>
              <p className="text-xs text-muted-foreground mt-1">点击"新建报价"开始创建第一个报价单</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => setLocation("/quotations/new")}>
                <Plus className="w-4 h-4 mr-1" />
                创建报价
              </Button>
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full" style={{ tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: colWidths.seq }} />
                  <col style={{ width: colWidths.customer }} />
                  <col style={{ width: colWidths.project }} />
                  <col style={{ width: colWidths.contact }} />
                  <col style={{ width: colWidths.status }} />
                  <col style={{ width: colWidths.amount }} />
                  <col style={{ width: colWidths.date }} />
                </colgroup>
                <thead>
                  <tr className="bg-muted/20 border-b text-xs text-muted-foreground">
                    <ResizableTh width={colWidths.seq} onResize={w => updateColWidth("seq", w)}>
                      <button onClick={() => toggleSort("quotationNo")} className="flex items-center gap-1 hover:text-foreground transition-colors">序号 <SortIcon col="quotationNo" /></button>
                    </ResizableTh>
                    <ResizableTh width={colWidths.customer} onResize={w => updateColWidth("customer", w)}>
                      <button onClick={() => toggleSort("customerName")} className="flex items-center gap-1 hover:text-foreground transition-colors">客户名称 <SortIcon col="customerName" /></button>
                    </ResizableTh>
                    <ResizableTh width={colWidths.project} onResize={w => updateColWidth("project", w)}>
                      <button onClick={() => toggleSort("projectName")} className="flex items-center gap-1 hover:text-foreground transition-colors">项目名称 <SortIcon col="projectName" /></button>
                    </ResizableTh>
                    <ResizableTh width={colWidths.contact} onResize={w => updateColWidth("contact", w)}>
                      <button onClick={() => toggleSort("customerContact")} className="flex items-center gap-1 hover:text-foreground transition-colors">销售联系人 <SortIcon col="customerContact" /></button>
                    </ResizableTh>
                    <ResizableTh width={colWidths.status} onResize={w => updateColWidth("status", w)}>
                      <button onClick={() => toggleSort("status")} className="flex items-center gap-1 hover:text-foreground transition-colors">状态 <SortIcon col="status" /></button>
                    </ResizableTh>
                    <ResizableTh width={colWidths.amount} onResize={w => updateColWidth("amount", w)}>
                      <button onClick={() => toggleSort("totalAmount")} className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors">金额 <SortIcon col="totalAmount" /></button>
                    </ResizableTh>
                    <ResizableTh width={colWidths.date} onResize={w => updateColWidth("date", w)}>
                      <button onClick={() => toggleSort("createdAt")} className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors">创建日期 <SortIcon col="createdAt" /></button>
                    </ResizableTh>
                  </tr>
                </thead>
                <tbody>
                  {sortedRecent.map((q: any, idx: number) => (
                    <tr
                      key={q.id}
                      onClick={() => setLocation(`/quotations/${q.id}`)}
                      className="border-b border-border/50 hover:bg-accent/20 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-2.5 text-xs text-muted-foreground tabular-nums">{String(idx + 1).padStart(3, "0")}</td>
                      <td className="px-4 py-2.5 text-sm font-medium text-foreground truncate">{q.customerName || "未命名客户"}</td>
                      <td className="px-4 py-2.5 text-sm text-muted-foreground truncate">{q.projectName || "—"}</td>
                      <td className="px-4 py-2.5 text-sm text-muted-foreground truncate">{q.customerContact || "—"}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline" className={`text-xs ${QUOTATION_STATUS_COLORS[q.status] || ""}`}>
                          {QUOTATION_STATUS_LABELS[q.status] || q.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-sm font-medium tabular-nums text-foreground text-right">¥{Number(q.totalAmount || 0).toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap text-right">
                        {q.createdAt ? new Date(q.createdAt).toLocaleDateString("zh-CN", { month: "short", day: "numeric" }) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick Data Cards */}
        <div className="space-y-4">
          <div
            className="bg-card border rounded-lg p-5 hover:shadow-md transition-all cursor-pointer group stagger-child flex items-center gap-4"
            onClick={() => setLocation("/data")}
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Database className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              {sheetsQuery.isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : (
                <p className="text-2xl font-bold tabular-nums text-foreground">{totalProducts.toLocaleString()}</p>
              )}
              <p className="text-sm text-muted-foreground mt-0.5">产品总数</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </div>

          <div
            className="bg-card border rounded-lg p-5 hover:shadow-md transition-all cursor-pointer group stagger-child flex items-center gap-4"
            onClick={() => setLocation("/data")}
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              {sheetsQuery.isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : (
                <p className="text-2xl font-bold tabular-nums text-foreground">{sheets.length}</p>
              )}
              <p className="text-sm text-muted-foreground mt-0.5">产品系列</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </div>

          {summary?.version && (
            <div
              className="bg-card border rounded-lg p-5 hover:shadow-md transition-all cursor-pointer group stagger-child flex items-center gap-4"
              onClick={() => setLocation("/summary")}
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground truncate">{summary.version}</p>
                <p className="text-sm text-muted-foreground mt-0.5">CPL 最新版本</p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </div>
          )}
        </div>
      </div>

      {/* Row 5: Product Series Grid */}
      {sheets.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-foreground mb-3">产品系列概览</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {sheets.map((sheet) => (
              <button
                key={sheet.sheetName}
                onClick={() => setLocation(`/data?sheet=${encodeURIComponent(sheet.sheetName)}`)}
                className="bg-card border rounded-lg p-3 text-left hover:shadow-md hover:border-primary/30 transition-all group stagger-child"
              >
                <div className="flex items-center gap-2 mb-2">
                  <FileSpreadsheet className="w-4 h-4 text-primary/60 group-hover:text-primary transition-colors" />
                </div>
                <p className="text-xs font-medium text-foreground truncate">{sheet.sheetName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{sheet.productCount} 个产品</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {sheetsQuery.isLoading === false && sheets.length === 0 && (
        <div className="bg-card border rounded-lg p-10 text-center">
          <FileSpreadsheet className="w-12 h-12 text-muted-foreground/30 mx-auto" />
          <p className="text-sm font-medium text-foreground mt-4">暂无数据</p>
          <p className="text-xs text-muted-foreground mt-1">请先导入 CPL 数据文件</p>
          <button
            onClick={() => setLocation("/import")}
            className="mt-4 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
          >
            前往导入 →
          </button>
        </div>
      )}
    </div>
  );
}
