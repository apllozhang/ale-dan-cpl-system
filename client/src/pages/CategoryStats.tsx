import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package, Layers, TrendingUp, BarChart3 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useMemo } from "react";

const CHART_COLORS = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)",
  "#6366f1", "#8b5cf6", "#a855f7", "#c084fc", "#d8b4fe",
  "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe",
];

export default function CategoryStats() {
  const { data: stats, isLoading } = trpc.cpl.stats.useQuery();

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
      name: s.status || "未知",
      count: Number(s.count),
    }));
  }, [stats]);

  const salesCatData = useMemo(() => {
    if (!stats?.bySalesCategory) return [];
    return stats.bySalesCategory.map((s: any) => ({
      name: s.category || "未知",
      count: Number(s.count),
    }));
  }, [stats]);

  const chartConfig = {
    count: { label: "产品数量", color: "var(--chart-1)" },
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4 overflow-auto">
      <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <BarChart3 className="w-5 h-5" />
        分类统计
      </h1>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                <Package className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xl font-bold tabular-nums">{(stats?.total ?? 0).toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">产品总数</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xl font-bold tabular-nums">{stats?.bySheet?.length ?? 0}</div>
                <p className="text-xs text-muted-foreground">产品系列</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50 text-green-600">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xl font-bold tabular-nums">{stats?.byStatus?.length ?? 0}</div>
                <p className="text-xs text-muted-foreground">产品状态种类</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Products per sheet - Bar chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">各系列产品数量</CardTitle>
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
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">产品状态分布</CardTitle>
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
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={{ strokeWidth: 1 }}
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
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">销售类别分布</CardTitle>
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
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">各系列产品详情</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-xs font-semibold px-4 py-2 text-left">系列名称</th>
                  <th className="text-xs font-semibold px-4 py-2 text-right">产品数量</th>
                  <th className="text-xs font-semibold px-4 py-2 text-right">占比</th>
                </tr>
              </thead>
              <tbody>
                {(stats?.bySheet ?? []).map((s: any, i: number) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-accent/20">
                    <td className="px-4 py-2 text-sm">{s.sheetName}</td>
                    <td className="px-4 py-2 text-sm text-right tabular-nums font-medium">{Number(s.count).toLocaleString()}</td>
                    <td className="px-4 py-2 text-sm text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${Math.min(100, (Number(s.count) / (stats?.total || 1)) * 100 * 3)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">
                          {((Number(s.count) / (stats?.total || 1)) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </td>
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
