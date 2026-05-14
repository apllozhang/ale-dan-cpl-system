import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Database, FileSpreadsheet, Layers, FileText, Loader2, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const sheetsQuery = trpc.cpl.sheets.useQuery();
  const summaryQuery = trpc.cpl.summary.useQuery();

  const sheets = sheetsQuery.data ?? [];
  const summary = summaryQuery.data;
  const totalProducts = sheets.reduce((sum, s) => sum + s.productCount, 0);

  const isLoading = sheetsQuery.isLoading;

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          欢迎回来{user?.name ? `，${user.name}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          ALE DAN CPL 系统 — 产品价格表管理平台
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            {isLoading ? (
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
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            ) : (
              <p className="text-2xl font-bold tabular-nums text-foreground">{sheets.length}</p>
            )}
            <p className="text-sm text-muted-foreground mt-0.5">产品系列</p>
          </div>
        </div>

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
            <p className="text-2xl font-bold text-foreground">
              {summary ? "已更新" : "—"}
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">变更记录</p>
          </div>
        </div>
      </div>

      {/* Summary preview */}
      {summary && (
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="px-5 py-3 bg-muted/30 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">最新变更摘要</span>
            </div>
            {summary.version && (
              <Badge variant="secondary" className="text-xs font-normal">
                {summary.version}
              </Badge>
            )}
          </div>
          <div className="p-5">
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {summary.content
                .split("\n")
                .filter((l) => l.trim())
                .slice(0, 12)
                .map((line, i) => {
                  const trimmed = line.trim();
                  const isHeader = /^(新发布|调整|停售|WPL版本|Note:|2\d{3}年)/.test(trimmed);
                  return (
                    <p
                      key={i}
                      className={`text-sm ${isHeader ? "font-semibold text-foreground pt-2 first:pt-0" : "text-muted-foreground"}`}
                    >
                      {trimmed}
                    </p>
                  );
                })}
            </div>
            <button
              onClick={() => setLocation("/summary")}
              className="mt-3 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
            >
              查看完整变更记录 →
            </button>
          </div>
        </div>
      )}

      {/* Product series grid */}
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
      {!isLoading && sheets.length === 0 && (
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
