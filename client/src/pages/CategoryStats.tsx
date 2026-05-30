import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package, Layers, TrendingUp, BarChart3 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useMemo, useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useTableFeatures, type ColumnDef } from "@/hooks/useTableFeatures";
import gsap from "gsap";

const CHART_COLORS = [
  "#3b82f6", // 蓝
  "#ef4444", // 红
  "#22c55e", // 绿
  "#f59e0b", // 橙
  "#8b5cf6", // 紫
  "#06b6d4", // 青
  "#ec4899", // 粉
  "#14b8a6", // 蓝绿
  "#f97316", // 深橙
  "#6366f1", // 靛蓝
  "#84cc16", // 黄绿
  "#e11d48", // 玫红
  "#0ea5e9", // 天蓝
  "#a855f7", // 亮紫
];

function useCountUp(target: number, duration = 1000, decimals = 0, prefix = "", suffix = "") {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    const obj = { val: 0 };
    gsap.to(obj, {
      val: target,
      duration,
      ease: "power2.out",
      onUpdate: () => setValue(Number(obj.val.toFixed(decimals))),
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

export default function CategoryStats() {
  const { t } = useTranslation();
  const { data: stats, isLoading } = trpc.cpl.stats.useQuery();

  const tableColumns: ColumnDef[] = useMemo(() => [
    { key: "sheetName", label: t('stats.seriesName'), defaultWidth: 200, sortable: true },
    { key: "count", label: t('stats.productCount'), defaultWidth: 120, sortable: true },
    { key: "proportion", label: t('stats.proportion'), defaultWidth: 200, sortable: false },
  ], [t]);

  const { renderHeader, renderCell, sortData } = useTableFeatures(tableColumns);

  const sheetData = useMemo(() => {
    if (!stats?.bySheet) return [];
    return stats.bySheet.slice(0, 15).map((s: any) => ({
      name: s.sheetName.length > 20 ? s.sheetName.slice(0, 18) + "..." : s.sheetName,
      fullName: s.sheetName,
      count: Number(s.count),
    }));
  }, [stats]);

  const statusData = useMemo(() => {
    if (!stats?.byStatus) return [];
    return stats.byStatus.map((s: any) => ({
      name: s.status || t('stats.unknown'),
      count: Number(s.count),
    }));
  }, [stats]);

  const salesCatData = useMemo(() => {
    if (!stats?.bySalesCategory) return [];
    return stats.bySalesCategory.map((s: any) => ({
      name: s.category || t('stats.unknown'),
      count: Number(s.count),
    }));
  }, [stats]);

  const chartConfig = useMemo(() => ({
    count: { label: t('stats.productCount'), color: "var(--chart-1)" },
  }), [t]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const ready = !!stats;
  const containerRef = useStaggerIn<HTMLDivElement>(ready);
  const countTotal = useCountUp(stats?.total ?? 0, 1000);
  const countSeries = useCountUp(stats?.bySheet?.length ?? 0, 800);
  const countStatus = useCountUp(stats?.byStatus?.length ?? 0, 800);

  return (
    <div className="h-full flex flex-col gap-4 overflow-auto" ref={containerRef}>
      <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <BarChart3 className="w-5 h-5" />
        {t('stats.title')}
      </h1>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="stagger-child">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-info-soft text-info">
                <Package className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xl font-bold tabular-nums">{countTotal}</div>
                <p className="text-xs text-muted-foreground">{t('stats.totalProducts')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="stagger-child">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent text-accent-foreground">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xl font-bold tabular-nums">{countSeries}</div>
                <p className="text-xs text-muted-foreground">{t('stats.productSeries')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="stagger-child">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success-soft text-success">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xl font-bold tabular-nums">{countStatus}</div>
                <p className="text-xs text-muted-foreground">{t('stats.statusTypes')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Products per sheet - Bar chart */}
        <Card className="stagger-child">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('stats.seriesChart')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[350px] w-full">
              <BarChart data={sheetData} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Product status distribution - Pie chart */}
        <Card className="stagger-child">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('stats.statusChart')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[350px] w-full">
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={120}
                  label={({ name, percent, index }) => (
                    <text x={0} y={0} textAnchor="end" fill={CHART_COLORS[index % CHART_COLORS.length]} fontSize={11} fontWeight={600}>
                      {name} {(percent * 100).toFixed(0)}%
                    </text>
                  )}
                  labelLine={(props: any) => {
                    const { points, index } = props;
                    return <polyline points={points.map((p: any) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={CHART_COLORS[index % CHART_COLORS.length]} strokeWidth={1.5} />;
                  }}
                >
                  {statusData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Sales category distribution */}
      {salesCatData.length > 0 && (
        <Card className="stagger-child">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('stats.salesChart')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <BarChart data={salesCatData} margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={80} />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Sheet detail table */}
      <Card className="stagger-child">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">{t('stats.seriesDetail')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <table style={{ width: 'max-content', minWidth: '100%', tableLayout: 'fixed' }}>
              <thead>
                <tr className="border-b bg-muted/30">
                  {tableColumns.map((col, i) => renderHeader(col, i === tableColumns.length - 1))}
                </tr>
              </thead>
              <tbody>
                {sortData((stats?.bySheet ?? []).map((s: any) => ({
                  ...s,
                  sheetName: s.sheetName,
                  count: Number(s.count),
                  proportion: ((Number(s.count) / (stats?.total || 1)) * 100).toFixed(1),
                }))).map((s: any, i: number) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-accent/20">
                    {renderCell(tableColumns[0], false, <span className="text-sm">{s.sheetName}</span>)}
                    {renderCell(tableColumns[1], false,
                      <span className="text-sm text-right tabular-nums font-medium block">{Number(s.count).toLocaleString()}</span>
                    )}
                    {renderCell(tableColumns[2], true,
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${Math.min(100, (Number(s.count) / (stats?.total || 1)) * 100 * 3)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">
                          {s.proportion}%
                        </span>
                      </div>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
