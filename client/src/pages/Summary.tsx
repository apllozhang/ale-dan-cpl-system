import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { FileText, Loader2, Info, ClipboardCheck } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { useTranslation } from "react-i18next";

type TabKey = "price" | "spec";

export default function Summary() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabKey>("price");

  const tabs = [
    { key: "price" as const, icon: FileText, label: t('summary.tabPrice') },
    { key: "spec" as const, icon: ClipboardCheck, label: t('summary.tabSpec') },
  ];

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <FileText className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold text-foreground">{t('summary.title')}</h1>
      </div>

      {/* TAB Bar */}
      <div className="flex border-b border-border">
        {tabs.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* TAB Content */}
      {tab === "price" ? <PriceChangeLog /> : <SpecChangeLog />}
    </div>
  );
}

// ==================== Price Change Log (original) ====================
function PriceChangeLog() {
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
      <div className="flex items-center justify-center" style={{ minHeight: "12rem" }}>
        <EmptyState icon={Info} title="暂无变更记录" description="请先导入 CPL 数据文件" />
      </div>
    );
  }

  const lines = summary.content.split("\n").filter((l) => l.trim());

  return (
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
  );
}

// ==================== Spec Change Log ====================
function SpecChangeLog() {
  const { t } = useTranslation();
  const summaryQuery = trpc.productSpecs.specSummary.useQuery();

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
      <div className="flex items-center justify-center" style={{ minHeight: "12rem" }}>
        <EmptyState icon={Info} title={t('summary.noSpecChanges', { defaultValue: '暂无参数变更记录' })} description={t('import.specInstructions')} />
      </div>
    );
  }

  const lines = summary.summaryContent.split("\n").filter((l: string) => l.trim());

  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      <div className="px-5 py-3 bg-muted/30 border-b">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">{summary.name}</span>
          <span className="text-xs text-muted-foreground">
            {t('import.time')}: {new Date(summary.createdAt).toLocaleString("zh-CN")}
          </span>
        </div>
      </div>
      <div className="p-5">
        <div className="space-y-1">
          {lines.map((line: string, index: number) => {
            const trimmed = line.trim();
            return (
              <div key={index} className="py-0.5">
                <span className="text-sm text-foreground/80">{trimmed}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
