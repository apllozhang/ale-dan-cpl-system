import { trpc } from "@/lib/trpc";
import { FileText, Loader2, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Summary() {
  const summaryQuery = trpc.cpl.summary.useQuery();

  if (summaryQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const summary = summaryQuery.data;

  if (!summary) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
        <Info className="w-10 h-10 opacity-30" />
        <p className="text-sm">暂无变更记录</p>
        <p className="text-xs">请先导入 CPL 数据文件</p>
      </div>
    );
  }

  const lines = summary.content.split("\n").filter((l) => l.trim());

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <FileText className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold text-foreground">变更记录</h1>
        {summary.version && (
          <Badge variant="secondary" className="font-normal text-xs">
            {summary.version}
          </Badge>
        )}
      </div>

      {/* Content card */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="px-5 py-3 bg-muted/30 border-b">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">CPL 更新摘要</span>
            <span className="text-xs text-muted-foreground">
              导入时间: {new Date(summary.importedAt).toLocaleString("zh-CN")}
            </span>
          </div>
        </div>
        <div className="p-5">
          <div className="space-y-1">
            {lines.map((line, index) => {
              const trimmed = line.trim();
              // Detect section headers
              const isHeader = /^(新发布|调整|停售|WPL版本|Note:|2\d{3}年)/.test(trimmed);
              const isSeparator = trimmed === "无";
              const isTaxCategory = !isHeader && !isSeparator && !trimmed.startsWith("Note") && !trimmed.includes("WPL版本") && index > 5;

              if (isHeader) {
                return (
                  <div key={index} className="pt-3 pb-1 first:pt-0">
                    <span className="text-sm font-semibold text-foreground">{trimmed}</span>
                  </div>
                );
              }
              if (isSeparator) {
                return (
                  <div key={index} className="py-0.5">
                    <span className="text-sm text-muted-foreground italic">{trimmed}</span>
                  </div>
                );
              }
              if (isTaxCategory) {
                return (
                  <div key={index} className="py-0.5 pl-4">
                    <span className="text-sm text-muted-foreground">· {trimmed}</span>
                  </div>
                );
              }
              return (
                <div key={index} className="py-0.5">
                  <span className="text-sm text-foreground/80">{trimmed}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
