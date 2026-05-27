import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, FileText, TrendingUp, Calculator, Target, Calendar } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend,
  AreaChart, Area,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useMemo, useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { QUOTATION_STATUS_LABELS, QUOTATION_STATUS_COLORS } from "@shared/const";
import gsap from "gsap";

const COLORS = [
  "#6366f1", "#3b82f6", "#06b6d4", "#22c55e", "#f59e0b",
  "#ef4444", "#ec4899", "#8b5cf6", "#14b8a6", "#f97316",
];

const KPI_GRADIENTS = [
  { from: "from-blue-500/10", to: "to-blue-600/5", icon: "bg-blue-500/15 text-blue-600", border: "border-blue-500/20" },
  { from: "from-emerald-500/10", to: "to-emerald-600/5", icon: "bg-emerald-500/15 text-emerald-600", border: "border-emerald-500/20" },
  { from: "from-violet-500/10", to: "to-violet-600/5", icon: "bg-violet-500/15 text-violet-600", border: "border-violet-500/20" },
  { from: "from-amber-500/10", to: "to-amber-600/5", icon: "bg-amber-500/15 text-amber-600", border: "border-amber-500/20" },
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

export default function BusinessAnalysis() {
  const { t } = useTranslation();
  const [preset, setPreset] = useState("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const dateParams = useMemo(() => {
    if (preset === "custom") return { startDate: customStart || undefined, endDate: customEnd || undefined };
    return getDateRange(preset);
  }, [preset, customStart, customEnd]);

  const { data, isLoading } = trpc.quotations.analytics.useQuery(dateParams);

  const summary = data?.summary ?? { totalQuotations: 0, completedRevenue: 0, avgAmount: 0, conversionRate: 0 };
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

  const industryData = useMemo(() => byIndustry.map((d: any) => ({
    name: (d.industry || t("analytics.unspecified")).slice(0, 10),
    count: Number(d.count),
    amount: Number(d.totalAmount),
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
    fill: STATUS_COLORS[d.status] || COLORS[0],
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
    count: { label: t("analytics.count"), color: "hsl(221, 83%, 53%)" },
    amount: { label: t("analytics.amount"), color: "hsl(142, 71%, 45%)" },
  }), [t]);

  const areaConfig = useMemo(() => ({
    count: { label: t("analytics.count"), color: "hsl(221, 83%, 53%)" },
    amount: { label: t("analytics.amount"), color: "hsl(142, 71%, 45%)" },
  }), [t]);

  const kpis = [
    { Icon: FileText, label: t("analytics.totalQuotations"), value: countQuotations, gradient: KPI_GRADIENTS[0] },
    { Icon: TrendingUp, label: t("analytics.completedRevenue"), value: countRevenue, gradient: KPI_GRADIENTS[1] },
    { Icon: Calculator, label: t("analytics.avgAmount"), value: countAvg, gradient: KPI_GRADIENTS[2] },
    { Icon: Target, label: t("analytics.conversionRate"), value: countRate, gradient: KPI_GRADIENTS[3] },
  ];

  const PRESETS = [
    { key: "thisMonth", label: t("analytics.dateFilter.thisMonth") },
    { key: "thisQuarter", label: t("analytics.dateFilter.thisQuarter") },
    { key: "thisYear", label: t("analytics.dateFilter.thisYear") },
    { key: "all", label: t("analytics.dateFilter.all") },
  ];

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
          {PRESETS.map(p => (
            <Button key={p.key} size="sm" variant={preset === p.key ? "default" : "outline"}
              onClick={() => setPreset(p.key)} className={`h-8 text-xs transition-all ${preset === p.key ? "shadow-md" : ""}`}>{p.label}</Button>
          ))}
          <div className="flex items-center gap-1">
            <Input type="date" value={customStart} onChange={e => { setCustomStart(e.target.value); setPreset("custom"); }}
              className="h-8 w-[130px] text-xs" placeholder={t("analytics.dateFilter.startDate")} />
            <span className="text-xs text-muted-foreground">~</span>
            <Input type="date" value={customEnd} onChange={e => { setCustomEnd(e.target.value); setPreset("custom"); }}
              className="h-8 w-[130px] text-xs" placeholder={t("analytics.dateFilter.endDate")} />
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
                  <p className="text-xs text-muted-foreground mt-0.5">{kpi.label}</p>
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
                <BarChart data={industryData} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border) / 0.5)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <defs>
                    <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={1} />
                    </linearGradient>
                  </defs>
                  <Bar dataKey="count" fill="url(#barGrad)" radius={[0, 6, 6, 0]} />
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
                      animationBegin={0} animationDuration={800}>
                      {statusData.map((d: any, i: number) => <Cell key={i} fill={d.fill} />)}
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
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0.5} />
                    </linearGradient>
                    <linearGradient id="salesGrad2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity={0.5} />
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
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{t("analytics.byCustomer")}</CardTitle></CardHeader>
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
                    {byCustomer.slice(0, 15).map((c: any, i: number) => {
                      const total = byCustomer.reduce((s: number, x: any) => s + Number(x.totalAmount), 0) || 1;
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
                                <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-500" style={{ width: `${pct}%` }} />
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
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="areaGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(v: number) => `¥${(v / 1000).toFixed(0)}k`} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area yAxisId="left" type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2.5}
                  fill="url(#areaGrad1)" dot={{ r: 3, fill: "#6366f1", strokeWidth: 2, stroke: "#fff" }}
                  activeDot={{ r: 5, fill: "#6366f1", strokeWidth: 2, stroke: "#fff" }} />
                <Area yAxisId="right" type="monotone" dataKey="amount" stroke="#22c55e" strokeWidth={2.5}
                  fill="url(#areaGrad2)" dot={{ r: 3, fill: "#22c55e", strokeWidth: 2, stroke: "#fff" }}
                  activeDot={{ r: 5, fill: "#22c55e", strokeWidth: 2, stroke: "#fff" }} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Row 4: Top Products */}
      {topProducts.length > 0 && (
        <Card className="stagger-child hover:shadow-lg transition-shadow duration-300">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{t("analytics.topProducts")}</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-xs font-semibold px-3 py-2 text-left w-10">#</th>
                    <th className="text-xs font-semibold px-3 py-2 text-left">{t("analytics.productModel")}</th>
                    <th className="text-xs font-semibold px-3 py-2 text-left">{t("analytics.productDesc")}</th>
                    <th className="text-xs font-semibold px-3 py-2 text-right">{t("analytics.frequency")}</th>
                    <th className="text-xs font-semibold px-3 py-2 text-right">{t("analytics.totalQuantity")}</th>
                    <th className="text-xs font-semibold px-3 py-2 text-right">{t("analytics.revenue")}</th>
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
                      <td className="px-3 py-1.5 text-sm font-medium">{p.productModel}</td>
                      <td className="px-3 py-1.5 text-sm text-muted-foreground truncate max-w-[200px]">{p.productDesc || "-"}</td>
                      <td className="px-3 py-1.5 text-sm text-right tabular-nums font-medium">{Number(p.quotationCount)}</td>
                      <td className="px-3 py-1.5 text-sm text-right tabular-nums">{Number(p.totalQuantity)}</td>
                      <td className="px-3 py-1.5 text-sm text-right tabular-nums font-medium">¥{Number(p.totalRevenue).toLocaleString()}</td>
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
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground stagger-child">
          <Calendar className="w-10 h-10 opacity-30 mb-3" />
          <p className="text-sm">{t("analytics.noData")}</p>
        </div>
      )}
    </div>
  );
}
