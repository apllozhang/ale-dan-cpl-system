import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, Download, Printer, FileSpreadsheet, ClipboardList } from "lucide-react";
import { useTranslation } from "react-i18next";
import { exportSpecTable } from "@/lib/specExport";

interface SpecMatchPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotationId: number;
}

export default function SpecMatchPreview({ open, onOpenChange, quotationId }: SpecMatchPreviewProps) {
  const { t } = useTranslation();

  const setsQuery = trpc.productSpecs.listSets.useQuery(
    { page: 1, pageSize: 100 },
    { enabled: open },
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4" />
            {t('techSpecs.selectSet')}
          </DialogTitle>
          <DialogDescription>{t('techSpecs.selectSetDesc')}</DialogDescription>
        </DialogHeader>

        {setsQuery.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : !setsQuery.data?.items?.length ? (
          <div className="text-center py-8">
            <FileSpreadsheet className="w-8 h-8 mx-auto text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground mt-2">{t('techSpecs.noSets')}</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-auto">
            {setsQuery.data.items.map((set: any) => (
              <SpecSetCard key={set.id} set={set} quotationId={quotationId} onClose={() => onOpenChange(false)} />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SpecSetCard({ set, quotationId, onClose }: { set: any; quotationId: number; onClose: () => void }) {
  const { t } = useTranslation();
  const [previewing, setPreviewing] = useState(false);

  const matchQuery = trpc.productSpecs.matchQuotation.useQuery(
    { quotationId, setId: set.id },
    { enabled: previewing },
  );

  const handlePreview = () => setPreviewing(true);

  if (previewing && matchQuery.isLoading) {
    return (
      <div className="rounded-lg border p-4 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{t('common.loading')}</span>
      </div>
    );
  }

  if (previewing && matchQuery.data) {
    const { matched, unmatched, quotation } = matchQuery.data;
    const specKeys = collectSpecKeys(matched);
    return (
      <MatchResultView
        matched={matched}
        unmatched={unmatched}
        specKeys={specKeys}
        quotation={quotation}
        onBack={() => setPreviewing(false)}
      />
    );
  }

  return (
    <button
      onClick={handlePreview}
      className="w-full rounded-lg border p-3 text-left hover:border-primary/40 hover:bg-accent/20 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{set.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('techSpecs.modelCount', { count: set.modelCount })}
            {set.description ? ` · ${set.description}` : ""}
          </p>
        </div>
        <FileSpreadsheet className="w-4 h-4 text-muted-foreground shrink-0 ml-2" />
      </div>
    </button>
  );
}

function MatchResultView({
  matched, unmatched, specKeys, quotation, onBack,
}: {
  matched: any[];
  unmatched: any[];
  specKeys: string[];
  quotation: any;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportSpecTable({ quotation, matched, unmatched, specKeys });
    } catch (err: any) {
      console.error(err);
    }
    setExporting(false);
  };

  const handlePrint = () => window.print();

  return (
    <div className="rounded-lg border">
      <div className="flex items-center justify-between p-3 border-b bg-muted/30">
        <button onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground">
          ← {t('common.back')}
        </button>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handlePrint} className="h-7 text-xs gap-1">
            <Printer className="w-3 h-3" />
            {t('techSpecs.print')}
          </Button>
          <Button size="sm" onClick={handleExport} disabled={exporting} className="h-7 text-xs gap-1">
            {exporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
            {t('techSpecs.exportExcel')}
          </Button>
        </div>
      </div>

      <div className="p-3 max-h-[50vh] overflow-auto">
        {matched.length > 0 && (
          <>
            <p className="text-xs font-semibold text-success mb-2">
              {t('techSpecs.matched', { count: matched.length })}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/40">
                    <th className="px-2 py-1.5 text-left font-semibold border border-border">#</th>
                    <th className="px-2 py-1.5 text-left font-semibold border border-border">{t('techSpecs.productModel')}</th>
                    <th className="px-2 py-1.5 text-left font-semibold border border-border">{t('techSpecs.productDesc')}</th>
                    <th className="px-2 py-1.5 text-center font-semibold border border-border">{t('quotation.quantity')}</th>
                    {specKeys.map(k => (
                      <th key={k} className="px-2 py-1.5 text-left font-semibold border border-border whitespace-nowrap">{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matched.map((item: any, idx: number) => (
                    <tr key={idx} className={idx % 2 === 1 ? "bg-muted/20" : ""}>
                      <td className="px-2 py-1 border border-border">{idx + 1}</td>
                      <td className="px-2 py-1 font-medium border border-border">{item.productModel}</td>
                      <td className="px-2 py-1 text-muted-foreground border border-border">{item.productDesc || ""}</td>
                      <td className="px-2 py-1 text-center border border-border">{item.quantity}</td>
                      {specKeys.map(k => (
                        <td key={k} className="px-2 py-1 border border-border">{item.specs?.[k] || ""}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {unmatched.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-destructive mb-2">
              {t('techSpecs.unmatched', { count: unmatched.length })}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/40">
                    <th className="px-2 py-1.5 text-left font-semibold border border-border">#</th>
                    <th className="px-2 py-1.5 text-left font-semibold border border-border">{t('techSpecs.productModel')}</th>
                    <th className="px-2 py-1.5 text-left font-semibold border border-border">{t('techSpecs.productDesc')}</th>
                    <th className="px-2 py-1.5 text-center font-semibold border border-border">{t('quotation.quantity')}</th>
                  </tr>
                </thead>
                <tbody>
                  {unmatched.map((item: any, idx: number) => (
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
          </div>
        )}
      </div>
    </div>
  );
}

function collectSpecKeys(matched: any[]): string[] {
  const keySet = new Set<string>();
  for (const item of matched) {
    if (item.specs) {
      for (const k of Object.keys(item.specs)) {
        keySet.add(k);
      }
    }
  }
  return Array.from(keySet);
}

