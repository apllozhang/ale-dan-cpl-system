import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Database, FileSpreadsheet, Layers, FileText, ArrowRight, Plus, List, Loader2, Clock } from "lucide-react";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState, useMemo } from "react";
import { QUOTATION_STATUS_LABELS, QUOTATION_STATUS_COLORS } from "@shared/const";

const DATE_PRESETS = [
  { key: "thisMonth", label: "本月" },
  { key: "thisQuarter", label: "本季度" },
  { key: "thisYear", label: "本年" },
  { key: "all", label: "全部" },
] as const;

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

function StatCard({ icon: Icon, label, value, color, loading }: {
  icon: any; label: string; value: string; color: string; loading?: boolean;
}) {
  return (
    <div className="bg-card border rounded-lg p-5 hover:shadow-md transition-all">
      <div className="flex items-center justify-between">
        <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      <div className="mt-4">
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

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [datePreset, setDatePreset] = useState<string>("thisMonth");

  const { startDate, endDate } = useMemo(() => getDateRange(datePreset), [datePreset]);

  const sheetsQuery = trpc.cpl.sheets.useQuery();
  const summaryQuery = trpc.cpl.summary.useQuery();
  const dashboardQuery = trpc.quotations.myDashboard.useQuery({
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  const sheets = sheetsQuery.data ?? [];
  const summary = summaryQuery.data;
  const totalProducts = sheets.reduce((sum, s) => sum + s.productCount, 0);
  const stats = dashboardQuery.data?.stats;
  const recent = dashboardQuery.data?.recent ?? [];

  const today = new Date();
  const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;

  return (
    <div className="space-y-6">
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

      {/* Row 3: KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={FileSpreadsheet}
          label="报价数"
          value={stats ? String(stats.totalQuotations) : "—"}
          color="bg-gradient-to-br from-blue-500 to-blue-600"
          loading={dashboardQuery.isLoading}
        />
        <StatCard
          icon={Database}
          label="成交额"
          value={stats ? `¥${stats.completedRevenue.toLocaleString()}` : "—"}
          color="bg-gradient-to-br from-emerald-500 to-emerald-600"
          loading={dashboardQuery.isLoading}
        />
        <StatCard
          icon={Clock}
          label="待处理"
          value={stats ? String(stats.pendingCount) : "—"}
          color="bg-gradient-to-br from-amber-500 to-amber-600"
          loading={dashboardQuery.isLoading}
        />
        <StatCard
          icon={FileText}
          label="待审批"
          value={stats ? String(stats.submittedCount) : "—"}
          color="bg-gradient-to-br from-violet-500 to-violet-600"
          loading={dashboardQuery.isLoading}
        />
      </div>

      {/* Row 4: Recent Activity + Quick Data */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Quotations */}
        <div className="lg:col-span-2 bg-card border rounded-lg overflow-hidden">
          <div className="px-5 py-3 bg-muted/30 border-b flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">最近动态</span>
            <button
              onClick={() => setLocation("/quotations")}
              className="text-xs text-primary hover:text-primary/80 font-medium"
            >
              查看全部 →
            </button>
          </div>
          <div className="divide-y">
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
              recent.map((q: any) => (
                <button
                  key={q.id}
                  onClick={() => setLocation(`/quotations/${q.id}`)}
                  className="w-full px-5 py-3 flex items-center justify-between hover:bg-accent/20 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-xs text-muted-foreground tabular-nums w-6 shrink-0">
                      {q.quotationNo?.slice(-3) || "—"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {q.customerName || "未命名客户"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{q.projectName || ""}</p>
                    </div>
                    <Badge variant="outline" className={`text-xs shrink-0 ${QUOTATION_STATUS_COLORS[q.status] || ""}`}>
                      {QUOTATION_STATUS_LABELS[q.status] || q.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 ml-4">
                    <span className="text-sm font-medium tabular-nums text-foreground">
                      ¥{Number(q.totalAmount || 0).toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {q.updatedAt ? new Date(q.updatedAt).toLocaleDateString("zh-CN", { month: "short", day: "numeric" }) : ""}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Quick Data Cards */}
        <div className="space-y-4">
          <div
            className="bg-card border rounded-lg p-5 hover:shadow-md transition-all cursor-pointer group"
            onClick={() => setLocation("/data")}
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Database className="w-5 h-5 text-primary" />
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="mt-4">
              {sheetsQuery.isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : (
                <p className="text-2xl font-bold tabular-nums text-foreground">{totalProducts.toLocaleString()}</p>
              )}
              <p className="text-sm text-muted-foreground mt-0.5">产品总数</p>
            </div>
          </div>

          <div
            className="bg-card border rounded-lg p-5 hover:shadow-md transition-all cursor-pointer group"
            onClick={() => setLocation("/data")}
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Layers className="w-5 h-5 text-primary" />
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="mt-4">
              {sheetsQuery.isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : (
                <p className="text-2xl font-bold tabular-nums text-foreground">{sheets.length}</p>
              )}
              <p className="text-sm text-muted-foreground mt-0.5">产品系列</p>
            </div>
          </div>

          {summary?.version && (
            <div
              className="bg-card border rounded-lg p-5 hover:shadow-md transition-all cursor-pointer group"
              onClick={() => setLocation("/summary")}
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="mt-4">
                <p className="text-sm font-bold text-foreground truncate">{summary.version}</p>
                <p className="text-sm text-muted-foreground mt-0.5">CPL 最新版本</p>
              </div>
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
                className="bg-card border rounded-lg p-3 text-left hover:shadow-md hover:border-primary/30 transition-all group"
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
