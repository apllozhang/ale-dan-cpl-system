import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, X } from "lucide-react";
import { useMemo } from "react";
import { QUOTATION_STATUS_LABELS, QUOTATION_STATUS_COLORS } from "@shared/const";

interface QuotationCompareProps {
  quotationIds: number[];
  onClose: () => void;
}

interface FlatItem {
  productModel: string;
  productDesc: string;
  listPrice: string;
  quantity: number;
  discountRate: number;
  subtotal: number;
}

interface ComparisonRow {
  productModel: string;
  quotationData: (FlatItem | null)[];
}

const COLORS = [
  "bg-info-soft border-info-border",
  "bg-success-soft border-success-border",
  "bg-warning-soft border-warning-border",
];

const HEADER_COLORS = [
  "text-info",
  "text-success",
  "text-warning",
];

function formatPrice(value: string | number | null | undefined): string {
  if (value == null) return "-";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "-";
  return `¥${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parseNum(val: any): number {
  if (val == null) return 0;
  const n = typeof val === "string" ? parseFloat(val) : Number(val);
  return isNaN(n) ? 0 : n;
}

export default function QuotationCompare({ quotationIds, onClose }: QuotationCompareProps) {
  // Fetch each quotation independently
  const q0 = trpc.quotations.getById.useQuery(
    { id: quotationIds[0] },
    { enabled: !!quotationIds[0] },
  );
  const q1 = trpc.quotations.getById.useQuery(
    { id: quotationIds[1] },
    { enabled: !!quotationIds[1] },
  );
  const q2 = trpc.quotations.getById.useQuery(
    { id: quotationIds[2] },
    { enabled: !!quotationIds[2] },
  );

  const queries = [q0, q1, q2].slice(0, quotationIds.length);
  const quotations = queries.map(q => q.data);
  const isLoading = queries.some(q => q.isLoading);

  // Build comparison rows: align matching product models across quotations
  const { rows, totals } = useMemo(() => {
    if (isLoading || quotations.some(q => !q)) return { rows: [], totals: [] };

    // Normalize items for each quotation
    const normalizedItems: FlatItem[][] = quotations.map(q =>
      (q?.items || []).map((item: any) => ({
        productModel: item.productModel || "",
        productDesc: item.productDesc || "",
        listPrice: item.listPrice || "",
        quantity: Number(item.quantity) || 1,
        discountRate: parseNum(item.discountRate),
        subtotal: parseNum(item.subtotal),
      })),
    );

    // Collect all unique product models in order of appearance
    const modelOrder: string[] = [];
    const seenModels = new Set<string>();
    for (const items of normalizedItems) {
      for (const item of items) {
        if (item.productModel && !seenModels.has(item.productModel)) {
          seenModels.add(item.productModel);
          modelOrder.push(item.productModel);
        }
      }
    }

    // Build index maps for fast lookup
    const indexMaps = normalizedItems.map(items => {
      const map = new Map<string, FlatItem>();
      for (const item of items) {
        if (!map.has(item.productModel)) {
          map.set(item.productModel, item);
        }
      }
      return map;
    });

    // Build comparison rows
    const comparisonRows: ComparisonRow[] = modelOrder.map(model => ({
      productModel: model,
      quotationData: indexMaps.map(map => map.get(model) || null),
    }));

    // Calculate totals
    const computedTotals = normalizedItems.map(items =>
      items.reduce((sum, item) => sum + item.subtotal, 0),
    );

    return { rows: comparisonRows, totals: computedTotals };
  }, [isLoading, quotations]);

  // Determine if a value differs across quotations for a given row
  const differs = (row: ComparisonRow, field: keyof FlatItem): boolean => {
    const values = row.quotationData
      .filter(d => d !== null)
      .map(d => {
        const val = d![field];
        return typeof val === "string" ? val.trim() : val;
      });
    if (values.length < 2) return false;
    return !values.every(v => v === values[0]);
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-background/80 flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">加载报价单对比数据...</span>
        </div>
      </div>
    );
  }

  const colCount = quotationIds.length;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 overflow-auto">
      <div className="max-w-[1400px] mx-auto p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-foreground">报价单对比</h1>
          <Button variant="outline" size="sm" onClick={onClose} className="gap-1.5">
            <X className="w-4 h-4" />
            关闭
          </Button>
        </div>

        {/* Quotation Header Cards */}
        <div className={`grid gap-4 ${colCount === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
          {quotations.map((q, idx) => (
            <Card key={q?.id ?? idx} className={`border ${COLORS[idx % COLORS.length]}`}>
              <CardHeader className="pb-2">
                <CardTitle className={`text-sm font-semibold ${HEADER_COLORS[idx % HEADER_COLORS.length]}`}>
                  {q?.quotationNo || `报价单 ${quotationIds[idx]}`}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">客户</span>
                  <span className="font-medium">{q?.customerName || "-"}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">项目</span>
                  <span className="font-medium">{q?.projectName || "-"}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">状态</span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] h-5 px-1.5 ${QUOTATION_STATUS_COLORS[q?.status || "draft"] || ""}`}
                  >
                    {QUOTATION_STATUS_LABELS[q?.status || "draft"]}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">创建人</span>
                  <span className="font-medium">{q?.creatorName || q?.creatorUsername || "-"}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">创建日期</span>
                  <span className="font-medium">
                    {q?.createdAt ? new Date(q.createdAt).toLocaleDateString("zh-CN") : "-"}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Comparison Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">产品明细对比</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  {/* Model / Description header row */}
                  <tr className="bg-muted/30 border-b border-border">
                    <th className="px-3 py-2 text-left font-semibold w-[180px] border-r border-border" rowSpan={2}>
                      产品型号
                    </th>
                    <th className="px-3 py-2 text-left font-semibold w-[200px] border-r border-border" rowSpan={2}>
                      产品说明
                    </th>
                    {/* Per-quotation column headers */}
                    {quotations.map((q, idx) => (
                      <th
                        key={q?.id ?? idx}
                        className={`px-3 py-2 text-center font-semibold border-r border-border last:border-r-0 ${HEADER_COLORS[idx % HEADER_COLORS.length]}`}
                        colSpan={3}
                      >
                        {q?.quotationNo || `#${quotationIds[idx]}`}
                      </th>
                    ))}
                  </tr>
                  {/* Sub-column headers */}
                  <tr className="bg-muted/20 border-b border-border">
                    {quotations.map((_, idx) => (
                      <>
                        <th key={`price-${idx}`} className="px-2 py-1.5 text-right font-medium border-r border-border">
                          媒体价
                        </th>
                        <th key={`qty-${idx}`} className="px-2 py-1.5 text-right font-medium border-r border-border">
                          数量
                        </th>
                        <th key={`disc-${idx}`} className="px-2 py-1.5 text-right font-medium border-r border-border last:border-r-0">
                          折扣(%)
                        </th>
                      </>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={2 + colCount * 3}
                        className="px-4 py-10 text-center text-muted-foreground"
                      >
                        无产品数据
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, rowIdx) => {
                      const priceDiff = differs(row, "listPrice");
                      const qtyDiff = differs(row, "quantity");
                      const discDiff = differs(row, "discountRate");

                      return (
                        <tr
                          key={rowIdx}
                          className={`border-b border-border/50 ${rowIdx % 2 === 0 ? "" : "bg-muted/10"}`}
                        >
                          {/* Product model - shared */}
                          <td className="px-3 py-2 font-medium border-r border-border">
                            {row.productModel}
                          </td>
                          {/* Description - from first available quotation */}
                          <td className="px-3 py-2 text-muted-foreground border-r border-border">
                            {row.quotationData.find(d => d !== null)?.productDesc || "-"}
                          </td>
                          {/* Per-quotation cells */}
                          {row.quotationData.map((data, qIdx) => (
                            <>
                              <td
                                key={`price-${rowIdx}-${qIdx}`}
                                className={`px-2 py-2 text-right tabular-nums border-r border-border ${priceDiff && data ? "bg-destructive/10 font-medium" : ""}`}
                              >
                                {data ? formatPrice(data.listPrice) : "-"}
                              </td>
                              <td
                                key={`qty-${rowIdx}-${qIdx}`}
                                className={`px-2 py-2 text-right tabular-nums border-r border-border ${qtyDiff && data ? "bg-destructive/10 font-medium" : ""}`}
                              >
                                {data ? data.quantity : "-"}
                              </td>
                              <td
                                key={`disc-${rowIdx}-${qIdx}`}
                                className={`px-2 py-2 text-right tabular-nums border-r border-border last:border-r-0 ${discDiff && data ? "bg-destructive/10 font-medium" : ""}`}
                              >
                                {data ? data.discountRate : "-"}
                              </td>
                            </>
                          ))}
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {/* Footer: totals */}
                <tfoot>
                  <tr className="bg-muted/30 border-t-2 border-border font-semibold">
                    <td className="px-3 py-2.5 border-r border-border" colSpan={2}>
                      合计金额
                    </td>
                    {totals.map((total, idx) => {
                      const totalDiff = totals.length > 1 && !totals.every(t => t === totals[0]);
                      return (
                        <td
                          key={`total-${idx}`}
                          className={`px-3 py-2.5 text-right tabular-nums border-r border-border last:border-r-0 ${totalDiff ? "bg-destructive/10" : ""}`}
                          colSpan={3}
                        >
                          <span className={HEADER_COLORS[idx % HEADER_COLORS.length]}>
                            {formatPrice(total)}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className={`grid gap-4 ${colCount === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
          {quotations.map((q, idx) => (
            <Card key={`summary-${q?.id ?? idx}`} className="border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{q?.quotationNo || `报价单 ${quotationIds[idx]}`}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">产品数量</span>
                    <span className="text-sm font-medium tabular-nums">
                      {q?.items?.length ?? 0} 项
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">合计金额</span>
                    <span className={`text-base font-bold tabular-nums ${HEADER_COLORS[idx % HEADER_COLORS.length]}`}>
                      {formatPrice(totals[idx])}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">整单折扣</span>
                    <span className="text-sm font-medium tabular-nums">
                      {q?.discountRate != null ? `${parseNum(q.discountRate)}%` : "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">有效期</span>
                    <span className="text-sm font-medium">
                      {q?.validUntil ? new Date(q.validUntil).toLocaleDateString("zh-CN") : "-"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
