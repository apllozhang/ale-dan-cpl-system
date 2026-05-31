import React, { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Download, ClipboardList, FileSpreadsheet } from "lucide-react";
import { useTranslation } from "react-i18next";
import { exportSpecTable } from "@/lib/specExport";
import type { SpecSetCoverage, MatchedSpecItem, UnmatchedSpecItem } from "@shared/types";
import { collectSpecKeys } from "@shared/utils";

interface SpecMatchPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotationId: number;
}

export default function SpecMatchPreview({ open, onOpenChange, quotationId }: SpecMatchPreviewProps) {
  const { t } = useTranslation();
  const [activeSetId, setActiveSetId] = useState<number | null>(null);

  const autoMatchQuery = trpc.productSpecs.autoMatch.useQuery(
    { quotationId },
    { enabled: open },
  );

  // When user switches set, re-fetch match results
  const matchQuery = trpc.productSpecs.matchQuotation.useQuery(
    { quotationId, setId: activeSetId! },
    { enabled: open && activeSetId !== null && activeSetId !== autoMatchQuery.data?.bestSetId },
  );

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setActiveSetId(null);
    }
  }, [open]);

  // Determine current display data
  const isCustomSet = activeSetId !== null && activeSetId !== autoMatchQuery.data?.bestSetId;
  const currentData = isCustomSet ? matchQuery.data : autoMatchQuery.data;
  const isLoading = autoMatchQuery.isLoading || (isCustomSet && matchQuery.isLoading);

  const sets = autoMatchQuery.data?.sets ?? [];
  const matched = currentData?.matched ?? [];
  const unmatched = currentData?.unmatched ?? [];
  const quotation = isCustomSet ? matchQuery.data?.quotation : autoMatchQuery.data?.quotation;
  const specKeys = isCustomSet
    ? collectSpecKeys(matched)
    : (autoMatchQuery.data?.specKeys ?? []);

  const totalItems = matched.length + unmatched.length;
  const coverageRate = totalItems > 0 ? Math.round((matched.length / totalItems) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="w-4 h-4" />
            {t('techSpecs.preview')}
          </DialogTitle>
        </DialogHeader>

        {/* Controls bar */}
        {sets.length > 0 && !isLoading && (
          <div className="flex items-center justify-between px-6 py-3 border-b bg-muted/20 shrink-0 gap-4 flex-wrap">
            {/* Set selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{t('techSpecs.specSet')}:</span>
              <select
                value={activeSetId ?? autoMatchQuery.data?.bestSetId ?? ""}
                onChange={(e) => setActiveSetId(Number(e.target.value))}
                className="h-7 text-xs border rounded px-2 bg-background max-w-[200px]"
              >
                {sets.map((s: SpecSetCoverage) => (
                  <option key={s.setId} value={s.setId}>
                    {s.setName} ({s.coverageRate}%)
                  </option>
                ))}
              </select>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-3">
              <CoverageBadge rate={coverageRate} matched={matched.length} total={totalItems} />
              {unmatched.length > 0 && (
                <span className="text-xs text-destructive font-medium">
                  {t('techSpecs.unmatched', { count: unmatched.length })}
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => {
                  if (quotation) {
                    exportSpecTable({
                      quotation,
                      matched,
                      unmatched,
                      specKeys,
                      fileName: `${t('techSpecs.preview')}_${quotation.customerName || "unknown"}_${new Date().toISOString().split("T")[0]}.xlsx`,
                    });
                  }
                }}
                disabled={!matched.length}
                className="h-7 text-xs gap-1"
              >
                <Download className="w-3 h-3" />
                {t('techSpecs.exportExcel')}
              </Button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {/* Loading state with animated progress bar */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-16 gap-4 w-full max-w-md mx-auto">
              <div className="flex items-center gap-2 mb-1">
                <ClipboardList className="w-4 h-4 text-primary animate-pulse" />
                <span className="text-sm font-medium text-foreground">{t('techSpecs.generating', '正在匹配参数...')}</span>
              </div>
              <MatchProgressBar />
            </div>
          )}

          {/* No sets */}
          {!isLoading && sets.length === 0 && (
            <div className="text-center py-16">
              <FileSpreadsheet className="w-10 h-10 mx-auto text-muted-foreground/30" />
              <p className="text-sm font-medium text-foreground mt-3">{t('techSpecs.noSets')}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('techSpecs.noSetsDesc')}</p>
            </div>
          )}

          {/* No items in quotation */}
          {!isLoading && sets.length > 0 && totalItems === 0 && (
            <div className="text-center py-16">
              <p className="text-sm text-muted-foreground">{t('techSpecs.noItems', '请先添加产品明细')}</p>
            </div>
          )}

          {/* All unmatched */}
          {!isLoading && sets.length > 0 && totalItems > 0 && matched.length === 0 && (
            <div className="text-center py-16">
              <FileSpreadsheet className="w-10 h-10 mx-auto text-muted-foreground/30" />
              <p className="text-sm font-medium text-foreground mt-3">
                {t('techSpecs.noMatch', { count: unmatched.length })}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t('techSpecs.noMatchHint', '当前报价单共 {{count}} 项产品在参数库中均无对应记录', { count: unmatched.length })}
              </p>
            </div>
          )}

          {/* Match results table */}
          {!isLoading && matched.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/40">
                    <th className="px-2 py-1.5 text-left font-semibold border border-border w-8">#</th>
                    <th className="px-2 py-1.5 text-left font-semibold border border-border min-w-[120px]">{t('techSpecs.productModel')}</th>
                    <th className="px-2 py-1.5 text-left font-semibold border border-border min-w-[160px]">{t('techSpecs.productDesc')}</th>
                    <th className="px-2 py-1.5 text-center font-semibold border border-border w-16">{t('quotation.quantity')}</th>
                    {specKeys.map(k => (
                      <th key={k} className="px-2 py-1.5 text-left font-semibold border border-border min-w-[100px] whitespace-nowrap">{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matched.map((item: MatchedSpecItem, idx: number) => (
                    <tr key={idx} className={idx % 2 === 1 ? "bg-muted/20" : ""}>
                      <td className="px-2 py-1 border border-border">{idx + 1}</td>
                      <td className="px-2 py-1 font-medium border border-border">{item.productModel}</td>
                      <td className="px-2 py-1 text-muted-foreground border border-border">{item.productDesc || ""}</td>
                      <td className="px-2 py-1 text-center border border-border">{item.quantity}</td>
                      {specKeys.map(k => (
                        <td key={k} className="px-2 py-1 border border-border whitespace-pre-wrap">{item.specs?.[k] || "—"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Unmatched section */}
              {unmatched.length > 0 && (
                <div className="mt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-destructive">
                      {t('techSpecs.unmatchedSection', '未匹配产品')}（{unmatched.length} {t('techSpecs.items', '项')}）
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {t('techSpecs.unmatchedHint', '辅材、配件等通常无参数数据，导出时参数列留白')}
                    </span>
                  </div>
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted/20">
                        <th className="px-2 py-1 text-left font-semibold border border-border w-8">#</th>
                        <th className="px-2 py-1 text-left font-semibold border border-border">{t('techSpecs.productModel')}</th>
                        <th className="px-2 py-1 text-left font-semibold border border-border">{t('techSpecs.productDesc')}</th>
                        <th className="px-2 py-1 text-center font-semibold border border-border">{t('quotation.quantity')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unmatched.map((item: UnmatchedSpecItem, idx: number) => (
                        <tr key={idx} className="text-muted-foreground">
                          <td className="px-2 py-1 border border-border">{matched.length + idx + 1}</td>
                          <td className="px-2 py-1 border border-border">{item.productModel}</td>
                          <td className="px-2 py-1 border border-border">{item.productDesc || ""}</td>
                          <td className="px-2 py-1 text-center border border-border">{item.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CoverageBadge({ rate, matched, total }: { rate: number; matched: number; total: number }) {
  const colorClass = rate >= 80
    ? "bg-success-soft text-success border-success-border"
    : rate >= 50
      ? "bg-warning-soft text-warning border-warning-border"
      : "bg-destructive/10 text-destructive border-destructive/20";

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded border ${colorClass}`}>
      {rate}% {matched}/{total}
    </span>
  );
}

function MatchProgressBar() {
  const { t } = useTranslation();
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const phaseIndex = Math.min(Math.floor(elapsed / 1500), 2);
      setPhase(phaseIndex);

      const t = Math.min(elapsed / 4000, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const target = phaseIndex === 0 ? 30 : phaseIndex === 1 ? 65 : 85;
      setProgress(Math.round(eased * target));
    }, 150);

    return () => clearInterval(interval);
  }, []);

  const phaseKeys = ["phaseScanning", "phaseMatching", "phaseBuilding"] as const;

  return (
    <div className="w-full space-y-2">
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300 ease-out relative"
          style={{ width: `${progress}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-[shimmer_1.5s_infinite]" />
        </div>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-[10px] text-muted-foreground">
          {t(`techSpecs.${phaseKeys[phase]}`)}...
        </span>
        <span className="text-[10px] text-muted-foreground font-mono">{progress}%</span>
      </div>
    </div>
  );
}

