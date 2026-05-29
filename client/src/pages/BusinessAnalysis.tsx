import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, FileText, TrendingUp, Calculator, Target, Calendar, X } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend,
  AreaChart, Area,
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { useMobilePreview } from "@/contexts/MobilePreviewContext";
import { QUOTATION_STATUS_LABELS, QUOTATION_STATUS_COLORS } from "@shared/const";
import gsap from "gsap";

const CHART_COLORS = [
  "#6366f1", "#3b82f6", "#06b6d4", "#22c55e", "#f59e0b",
  "#ef4444", "#ec4899", "#8b5cf6", "#14b8a6", "#f97316",
];

const KPI_GRADIENTS = [
  { from: "from-info/10", to: "to-info/5", icon: "bg-info/15 text-info", border: "border-info/20" },
  { from: "from-success/10", to: "to-success/5", icon: "bg-success/15 text-success", border: "border-success/20" },
  { from: "from-primary/10", to: "to-primary/5", icon: "bg-primary/15 text-primary", border: "border-primary/20" },
  { from: "from-warning/10", to: "to-warning/5", icon: "bg-warning/15 text-warning", border: "border-warning/20" },
];

const STATUS_COLORS: Record<string, string> = {
  draft: "#94a3b8",
  submitted: "#3b82f6",
  approved: "#22c55e",
  sent: "#8b5cf6",
  completed: "#10b981",
  cancelled: "#ef4444",
};

function useCountUp(target: number, duration = 1200, decimals = 0, prefix = "", suffix = "") {
  const [value, setValue] = useState(0);
  const ref = useRef({ val: 0 });
  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    ref.current.val = 0;
    const obj = { val: 0 };
    gsap.to(obj, {
      val: target,
      duration,
      ease: "power2.out",
      onUpdate: () => {
        ref.current.val = obj.val;
        setValue(Number(obj.val.toFixed(decimals)));
      },
    });
  }, [target, duration, decimals]);
  const formatted = value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return `${prefix}${formatted}${suffix}`;
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

function getDateRange(preset: string): { startDate?: string; endDate?: string } {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  switch (preset) {
    case "thisMonth":
      return { startDate: `${y}-${String(m + 1).padStart(2, "0")}-01` };
    case "thisQuarter": {
      const qStart = Math.floor(m / 3) * 3;
      return { startDate: `${y}-${String(qStart + 1).padStart(2, "0")}-01` };
    }
    case "thisYear":
      return { startDate: `${y}-01-01` };
    default:
      return {};
  }
}

function getPreviousPeriod(params: { startDate?: string; endDate?: string }): { startDate?: string; endDate?: string } {
  if (!params.startDate) return {};
  const start = new Date(params.startDate);
  const end = params.endDate ? new Date(params.endDate) : new Date();
  const diffMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - diffMs);
  return {
    startDate: prevStart.toISOString().slice(0, 10),
    endDate: prevEnd.toISOString().slice(0, 10),
  };
}

function FunnelChart({ data }: { data: { name: string; count: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  const maxCount = Math.max(...data.map(d => d.count)) || 1;
  return (
    <div className="flex flex-col gap-2">
      {data.map((d, i) => {
        const widthPct = Math.max(20, (d.count / maxCount) * 100);
        const pct = ((d.count / total) * 100).toFixed(1);
        return (
          <div key={i} className="flex items-center gap-3 stagger-child">
            <span className="text-xs text-muted-foreground w-16 text-right shrink-0">{d.name}</span>
            <div className="flex-1 relative h-9">
              <div
                className="absolute inset-y-0 left-0 rounded-lg transition-all duration-700 flex items-center justify-end pr-3"
                style={{ width: `${widthPct}%`, background: `linear-gradient(135deg, ${d.color}22, ${d.color}44)`, borderLeft: `3px solid ${d.color}` }}
              >
                <span className="text-xs font-bold" style={{ color: d.color }}>{d.count}</span>
              </div>
            </div>
            <span className="text-xs text-muted-foreground w-12 text-right shrink-0">{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}

// Resizable table hook for column drag-resize
function useResizableColumns(initialWidths: number[]) {
  const [widths, setWidths] = useState(initialWidths);
  const dragging = useRef<{ colIndex: number; startX: number; startWidth: number } | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  const onResizeStart = useCallback((colIndex: number, e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = { colIndex, startX: e.clientX, startWidth: widths[colIndex] };
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const diff = ev.clientX - dragging.current.startX;
      setWidths(prev => {
        const next = [...prev];
        next[dragging.current!.colIndex] = Math.max(40, dragging.current!.startWidth + diff);
        return next;
      });
    };
    const onUp = () => {
      dragging.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [widths]);

  return { widths, onResizeStart, tableRef };
}

export default function BusinessAnalysis() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const isMobilePreview = useMobilePreview();
  const [preset, setPreset] = useState("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const dateParams = useMemo(() => {
    if (preset === "custom") return { startDate: customStart || undefined, endDate: customEnd || undefined };
    return getDateRange(preset);
  }, [preset, customStart, customEnd]);

  const { data, isLoading } = trpc.quotations.analytics.useQuery(dateParams);

  const prevParams = useMemo(() => dateParams.startDate ? getPreviousPeriod(dateParams) : undefined, [dateParams.startDate, dateParams.endDate]);
  const { data: prevData } = trpc.quotations.analytics.useQuery(prevParams ?? { startDate: undefined, endDate: undefined }, { enabled: !!prevParams?.startDate });

  const [industryFilter, setIndustryFilter] = useState<string | null>(null);

  const summary = data?.summary ?? { totalQuotations: 0, completedRevenue: 0, avgAmount: 0, conversionRate: 0 };
  const prevSummary = prevData?.summary ?? { totalQuotations: 0, completedRevenue: 0, avgAmount: 0, conversionRate: 0 };
  const byIndustry = data?.byIndustry ?? [];
  const byCustomer = data?.byCustomer ?? [];
  const bySalesRep = data?.bySalesRep ?? [];
  const byTime = data?.byTime ?? [];
  const byStatus = data?.byStatus ?? [];
  const topProducts = data?.topProducts ?? [];

  const countQuotations = useCountUp(summary.totalQuotations, 1000, 0);
  const countRevenue = useCountUp(summary.completedRevenue, 1200, 0, "¥");
  const countAvg = useCountUp(summary.avgAmount, 1000, 0, "¥");
  const countRate = useCountUp(summary.conversionRate * 100, 800, 1, "", "%");

  const industryData = useMemo(() => byIndustry.map((d: any, i: number) => ({
    name: (d.industry || t("analytics.unspecified")).slice(0, 10),
    count: Number(d.count),
    amount: Number(d.totalAmount),
    fill: CHART_COLORS[i % CHART_COLORS.length],
  })), [byIndustry, t]);

  const funnelData = useMemo(() => {
    const order = ["draft", "submitted", "approved", "sent", "completed", "cancelled"];
    return order
      .map(s => {
        const found = byStatus.find((d: any) => d.status === s);
        return found ? { name: QUOTATION_STATUS_LABELS[s] || s, count: Number(found.count), color: STATUS_COLORS[s] } : null;
      })
      .filter(Boolean) as { name: string; count: number; color: string }[];
  }, [byStatus]);

  const statusData = useMemo(() => byStatus.map((d: any) => ({
    name: QUOTATION_STATUS_LABELS[d.status] || d.status,
    count: Number(d.count),
    amount: Number(d.totalAmount),
    fill: STATUS_COLORS[d.status] || CHART_COLORS[0],
  })), [byStatus]);

  const timeData = useMemo(() => {
    if (byTime.length === 0) return [];
    const months: Record<string, { month: string; count: number; amount: number }> = {};
    byTime.forEach((d: any) => {
      months[d.month] = { month: d.month, count: Number(d.count), amount: Number(d.totalAmount) };
    });
    const result = [];
    const keys = Object.keys(months).sort();
    const start = new Date(keys[0] + "-01");
    const end = new Date(keys[keys.length - 1] + "-01");
    const cur = new Date(start);
    while (cur <= end) {
      const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`;
      result.push(months[key] || { month: key, count: 0, amount: 0 });
      cur.setMonth(cur.getMonth() + 1);
    }
    return result;
  }, [byTime]);

  const salesRepData = useMemo(() => bySalesRep.map((d: any) => ({
    name: (d.repName || "Unknown").slice(0, 8),
    count: Number(d.count),
    amount: Number(d.totalAmount),
    rate: Number(d.submittedCount) > 0 ? Math.round(Number(d.completedCount) / Number(d.submittedCount) * 100) : 0,
  })), [bySalesRep]);

  const barConfig = useMemo(() => ({
    count: { label: t("analytics.count"), color: CHART_COLORS[0] },
    amount: { label: t("analytics.amount"), color: CHART_COLORS[3] },
  }), [t]);

  const areaConfig = useMemo(() => ({
    count: { label: t("analytics.count"), color: CHART_COLORS[0] },
    amount: { label: t("analytics.amount"), color: CHART_COLORS[3] },
  }), [t]);

  function calcChange(current: number, previous: number): string | null {
    if (!previous || previous === 0) return current > 0 ? null : null;
    const pct = ((current - previous) / previous * 100).toFixed(1);
    return pct;
  }

  const kpis = [
    { Icon: FileText, label: t("analytics.totalQuotations"), value: countQuotations, gradient: KPI_GRADIENTS[0], change: calcChange(summary.totalQuotations, prevSummary.totalQuotations) },
    { Icon: TrendingUp, label: t("analytics.completedRevenue"), value: countRevenue, gradient: KPI_GRADIENTS[1], change: calcChange(summary.completedRevenue, prevSummary.completedRevenue) },
    { Icon: Calculator, label: t("analytics.avgAmount"), value: countAvg, gradient: KPI_GRADIENTS[2], change: calcChange(summary.avgAmount, prevSummary.avgAmount) },
    { Icon: Target, label: t("analytics.conversionRate"), value: countRate, gradient: KPI_GRADIENTS[3], change: calcChange(summary.conversionRate * 100, prevSummary.conversionRate * 100) },
  ];

  const PRESETS = [
    { key: "thisMonth", label: t("analytics.dateFilter.thisMonth") },
    { key: "thisQuarter", label: t("analytics.dateFilter.thisQuarter") },
    { key: "thisYear", label: t("analytics.dateFilter.thisYear") },
    { key: "all", label: t("analytics.dateFilter.all") },
  ];

  // Resizable columns for top products table: #, model, desc, freq, qty, revenue
  const productTable = useResizableColumns([40, 160, 240, 80, 80, 120]);

  const ready = !isLoading;
  const containerRef = useStaggerIn<HTMLDivElement>(ready);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full flex flex-col gap-4 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap stagger-child">
        <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5">
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>
          {t("analytics.title")}
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          {isMobilePreview ? (
            <Select value={preset} onValueChange={v => setPreset(v)}>
              <SelectTrigger className="h-8 w-[130px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRESETS.map(p => (
                  <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            PRESETS.map(p => (
              <Button key={p.key} size="sm" variant={preset === p.key ? "default" : "outline"}
                onClick={() => setPreset(p.key)} className={`h-8 text-xs transition-all ${preset === p.key ? "shadow-md" : ""}`}>{p.label}</Button>
            ))
          )}
          <div className="flex items-center gap-1">
            <Input type="date" value={customStart} onChange={e => { setCustomStart(e.target.value); setPreset("custom"); }}
              className={`h-8 text-xs ${isMobilePreview ? "w-[110px]" : "w-[130px]"}`} placeholder={t("analytics.dateFilter.startDate")} />
            <span className="text-xs text-muted-foreground">~</span>
            <Input type="date" value={customEnd} onChange={e => { setCustomEnd(e.target.value); setPreset("custom"); }}
              className={`h-8 text-xs ${isMobilePreview ? "w-[110px]" : "w-[130px]"}`} placeholder={t("analytics.dateFilter.endDate")} />
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <Card key={i} className={`stagger-child overflow-hidden border ${kpi.gradient.border} backdrop-blur-sm bg-gradient-to-br ${kpi.gradient.from} ${kpi.gradient.to} hover:shadow-lg transition-shadow duration-300`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${kpi.gradient.icon}`}>
                  <kpi.Icon className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="text-2xl font-bold tabular-nums tracking-tight">{kpi.value}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-muted-foreground">{kpi.label}</p>
                    {kpi.change !== null && (
                      <span className={`text-[10px] font-medium px-1 py-0.5 rounded ${Number(kpi.change) >= 0 ? "text-success bg-success/10" : "text-destructive bg-destructive/10"}`}>
                        {Number(kpi.change) >= 0 ? "+" : ""}{kpi.change}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Row 1: Industry + Status Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {industryData.length > 0 && (
          <Card className="stagger-child hover:shadow-lg transition-shadow duration-300">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{t("analytics.byIndustry")}</CardTitle></CardHeader>
            <CardContent>
              <ChartContainer config={barConfig} className="h-[320px] w-full">
                <BarChart data={industryData} layout="vertical" margin={{ left: 10, right: 20 }}
                  onClick={(e: any) => { if (e?.activePayload?.[0]?.payload?.name) setIndustryFilter(e.activePayload[0].payload.name); }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border) / 0.5)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} className="cursor-pointer">
                    {industryData.map((entry: any, i: number) => (
                      <Cell key={i} fill={entry.fill} className="cursor-pointer" />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}

        {funnelData.length > 0 && (
          <Card className="stagger-child hover:shadow-lg transition-shadow duration-300">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{t("analytics.byStatus")}</CardTitle></CardHeader>
            <CardContent className="pt-2">
              <FunnelChart data={funnelData} />
              <div className="mt-4">
                <ChartContainer config={barConfig} className="h-[120px] w-full">
                  <PieChart>
                    <Pie data={statusData} dataKey="count" nameKey="name" cx="50%" cy="50%"
                      innerRadius={30} outerRadius={55} paddingAngle={2}
                      animationBegin={0} animationDuration={800}
                      onClick={(_data: any, index: number) => {
                        const statusEntry = statusData[index];
                        if (statusEntry) {
                          const statusKey = byStatus[index]?.status;
                          if (statusKey) setLocation(`/quotations?status=${statusKey}`);
                        }
                      }}
                      className="cursor-pointer">
                      {statusData.map((d: any, i: number) => <Cell key={i} fill={d.fill} className="cursor-pointer" />)}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Row 2: Sales Rep + Customer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {salesRepData.length > 0 && (
          <Card className="stagger-child hover:shadow-lg transition-shadow duration-300">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{t("analytics.bySalesRep")}</CardTitle></CardHeader>
            <CardContent>
              <ChartContainer config={barConfig} className="h-[320px] w-full">
                <BarChart data={salesRepData} margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <defs>
                    <linearGradient id="salesGrad1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS[0]} stopOpacity={0.9} />
                      <stop offset="100%" stopColor={CHART_COLORS[0]} stopOpacity={0.5} />
                    </linearGradient>
                    <linearGradient id="salesGrad2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS[3]} stopOpacity={0.9} />
                      <stop offset="100%" stopColor={CHART_COLORS[3]} stopOpacity={0.5} />
                    </linearGradient>
                  </defs>
                  <Bar yAxisId="left" dataKey="count" fill="url(#salesGrad1)" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="amount" fill="url(#salesGrad2)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}

        {byCustomer.length > 0 && (
          <Card className="stagger-child hover:shadow-lg transition-shadow duration-300">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">{t("analytics.byCustomer")}</CardTitle>
              {industryFilter && (
                <button onClick={() => setIndustryFilter(null)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                  {industryFilter} <X className="w-3 h-3" />
                </button>
              )}
            </CardHeader>
            <CardContent>
              <div className="overflow-auto max-h-[320px]">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/30 sticky top-0">
                      <th className="text-xs font-semibold px-3 py-2 text-left w-10">#</th>
                      <th className="text-xs font-semibold px-3 py-2 text-left">{t("analytics.customerName")}</th>
                      <th className="text-xs font-semibold px-3 py-2 text-right">{t("analytics.count")}</th>
                      <th className="text-xs font-semibold px-3 py-2 text-right">{t("analytics.amount")}</th>
                      <th className="text-xs font-semibold px-3 py-2 text-right w-24">{t("analytics.proportion")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byCustomer
                      .filter((c: any) => !industryFilter || c.industry?.includes(industryFilter))
                      .slice(0, 10).map((c: any, i: number) => {
                      const filtered = byCustomer.filter((c: any) => !industryFilter || c.industry?.includes(industryFilter));
                      const total = filtered.reduce((s: number, x: any) => s + Number(x.totalAmount), 0) || 1;
                      const pct = (Number(c.totalAmount) / total * 100).toFixed(1);
                      return (
                        <tr key={i} className="border-b border-border/50 hover:bg-accent/20 transition-colors">
                          <td className="px-3 py-1.5 text-sm">
                            {i < 3 ? (
                              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white ${i === 0 ? "bg-amber-500" : i === 1 ? "bg-slate-400" : "bg-amber-700"}`}>{i + 1}</span>
                            ) : (
                              <span className="text-muted-foreground text-xs">{i + 1}</span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-sm font-medium truncate max-w-[140px]">{c.customerName}</td>
                          <td className="px-3 py-1.5 text-sm text-right tabular-nums">{Number(c.count)}</td>
                          <td className="px-3 py-1.5 text-sm text-right tabular-nums font-medium">¥{Number(c.totalAmount).toLocaleString()}</td>
                          <td className="px-3 py-1.5">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                              </div>
                              <span className="text-[10px] text-muted-foreground w-10 text-right tabular-nums">{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Row 3: Time Trend - Area Chart */}
      {timeData.length > 0 && (
        <Card className="stagger-child hover:shadow-lg transition-shadow duration-300">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{t("analytics.byTime")}</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={areaConfig} className="h-[300px] w-full">
              <AreaChart data={timeData} margin={{ left: 10, right: 20 }}>
                <defs>
                  <linearGradient id="areaGrad1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS[0]} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={CHART_COLORS[0]} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="areaGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS[3]} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={CHART_COLORS[3]} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(v: number) => `¥${(v / 1000).toFixed(0)}k`} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area yAxisId="left" type="monotone" dataKey="count" stroke={CHART_COLORS[0]} strokeWidth={2.5}
                  fill="url(#areaGrad1)" dot={{ r: 3, fill: CHART_COLORS[0], strokeWidth: 2, stroke: "#fff" }}
                  activeDot={{ r: 5, fill: CHART_COLORS[0], strokeWidth: 2, stroke: "#fff" }} />
                <Area yAxisId="right" type="monotone" dataKey="amount" stroke={CHART_COLORS[3]} strokeWidth={2.5}
                  fill="url(#areaGrad2)" dot={{ r: 3, fill: CHART_COLORS[3], strokeWidth: 2, stroke: "#fff" }}
                  activeDot={{ r: 5, fill: CHART_COLORS[3], strokeWidth: 2, stroke: "#fff" }} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Row 4: Top Products - Resizable Columns */}
      {topProducts.length > 0 && (
        <Card className="stagger-child hover:shadow-lg transition-shadow duration-300">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{t("analytics.topProducts")}</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-auto">
              <table ref={productTable.tableRef} className="w-full" style={{ tableLayout: "fixed" }}>
                <colgroup>
                  {productTable.widths.map((w, i) => (
                    <col key={i} style={{ width: w }} />
                  ))}
                </colgroup>
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-xs font-semibold px-3 py-2 text-left relative select-none" style={{ width: productTable.widths[0] }}>
                      #
                      <div className="absolute right-[-2px] top-1 bottom-1 w-[5px] cursor-col-resize rounded-sm bg-border/60 hover:bg-primary hover:w-[7px] transition-all z-10 flex items-center justify-center"
                        onMouseDown={(e) => productTable.onResizeStart(0, e)}>
                        <svg width="4" height="12" viewBox="0 0 4 12" className="opacity-0 hover:opacity-100"><circle cx="2" cy="2" r="1.2" fill="currentColor" className="text-primary" /><circle cx="2" cy="6" r="1.2" fill="currentColor" className="text-primary" /><circle cx="2" cy="10" r="1.2" fill="currentColor" className="text-primary" /></svg>
                      </div>
                    </th>
                    <th className="text-xs font-semibold px-3 py-2 text-center relative select-none overflow-hidden text-ellipsis whitespace-nowrap" style={{ width: productTable.widths[1] }}>
                      {t("analytics.productModel")}
                      <div className="absolute right-[-2px] top-1 bottom-1 w-[5px] cursor-col-resize rounded-sm bg-border/60 hover:bg-primary hover:w-[7px] transition-all z-10 flex items-center justify-center"
                        onMouseDown={(e) => productTable.onResizeStart(1, e)}>
                        <svg width="4" height="12" viewBox="0 0 4 12" className="opacity-0 hover:opacity-100"><circle cx="2" cy="2" r="1.2" fill="currentColor" className="text-primary" /><circle cx="2" cy="6" r="1.2" fill="currentColor" className="text-primary" /><circle cx="2" cy="10" r="1.2" fill="currentColor" className="text-primary" /></svg>
                      </div>
                    </th>
                    <th className="text-xs font-semibold px-3 py-2 text-left relative select-none overflow-hidden text-ellipsis whitespace-nowrap" style={{ width: productTable.widths[2] }}>
                      {t("analytics.productDesc")}
                      <div className="absolute right-[-2px] top-1 bottom-1 w-[5px] cursor-col-resize rounded-sm bg-border/60 hover:bg-primary hover:w-[7px] transition-all z-10 flex items-center justify-center"
                        onMouseDown={(e) => productTable.onResizeStart(2, e)}>
                        <svg width="4" height="12" viewBox="0 0 4 12" className="opacity-0 hover:opacity-100"><circle cx="2" cy="2" r="1.2" fill="currentColor" className="text-primary" /><circle cx="2" cy="6" r="1.2" fill="currentColor" className="text-primary" /><circle cx="2" cy="10" r="1.2" fill="currentColor" className="text-primary" /></svg>
                      </div>
                    </th>
                    <th className="text-xs font-semibold px-3 py-2 text-center relative select-none overflow-hidden text-ellipsis whitespace-nowrap" style={{ width: productTable.widths[3] }}>
                      {t("analytics.frequency")}
                      <div className="absolute right-[-2px] top-1 bottom-1 w-[5px] cursor-col-resize rounded-sm bg-border/60 hover:bg-primary hover:w-[7px] transition-all z-10 flex items-center justify-center"
                        onMouseDown={(e) => productTable.onResizeStart(3, e)}>
                        <svg width="4" height="12" viewBox="0 0 4 12" className="opacity-0 hover:opacity-100"><circle cx="2" cy="2" r="1.2" fill="currentColor" className="text-primary" /><circle cx="2" cy="6" r="1.2" fill="currentColor" className="text-primary" /><circle cx="2" cy="10" r="1.2" fill="currentColor" className="text-primary" /></svg>
                      </div>
                    </th>
                    <th className="text-xs font-semibold px-3 py-2 text-center relative select-none overflow-hidden text-ellipsis whitespace-nowrap" style={{ width: productTable.widths[4] }}>
                      {t("analytics.totalQuantity")}
                      <div className="absolute right-[-2px] top-1 bottom-1 w-[5px] cursor-col-resize rounded-sm bg-border/60 hover:bg-primary hover:w-[7px] transition-all z-10 flex items-center justify-center"
                        onMouseDown={(e) => productTable.onResizeStart(4, e)}>
                        <svg width="4" height="12" viewBox="0 0 4 12" className="opacity-0 hover:opacity-100"><circle cx="2" cy="2" r="1.2" fill="currentColor" className="text-primary" /><circle cx="2" cy="6" r="1.2" fill="currentColor" className="text-primary" /><circle cx="2" cy="10" r="1.2" fill="currentColor" className="text-primary" /></svg>
                      </div>
                    </th>
                    <th className="text-xs font-semibold px-3 py-2 text-center" style={{ width: productTable.widths[5] }}>
                      {t("analytics.revenue")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((p: any, i: number) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-accent/20 transition-colors">
                      <td className="px-3 py-1.5 text-sm">
                        {i < 3 ? (
                          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white ${i === 0 ? "bg-amber-500" : i === 1 ? "bg-slate-400" : "bg-amber-700"}`}>{i + 1}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">{i + 1}</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-sm font-medium text-center whitespace-normal break-words">{p.productModel}</td>
                      <td className="px-3 py-1.5 text-sm text-muted-foreground whitespace-normal break-words">{p.productDesc || "-"}</td>
                      <td className="px-3 py-1.5 text-sm text-center tabular-nums font-medium">{Number(p.quotationCount)}</td>
                      <td className="px-3 py-1.5 text-sm text-center tabular-nums">{Number(p.totalQuantity)}</td>
                      <td className="px-3 py-1.5 text-sm text-center tabular-nums font-medium">¥{Number(p.totalRevenue).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!isLoading && summary.totalQuotations === 0 && (
        <EmptyState
          icon={Calendar}
          title={t("analytics.noData")}
        />
      )}
    </div>
  );
}
