import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Download, Share2 } from "lucide-react";
import { useParams } from "wouter";
import { QUOTATION_STATUS_LABELS, QUOTATION_STATUS_COLORS } from "@shared/const";
import { exportQuotationToExcel } from "@/lib/quotationExport";

export default function QuotationShared() {
  const { token } = useParams<{ token: string }>();
  const { data: quotation, isLoading } = trpc.sharing.getByToken.useQuery(
    { token: token || "" },
    { enabled: !!token }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card className="w-[400px]">
          <CardContent className="p-8 text-center">
            <Share2 className="w-10 h-10 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold">报价单不存在</h2>
            <p className="text-sm text-muted-foreground mt-2">该分享链接无效或已过期</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const items = (quotation.items || []).map((item: any) => ({
    ...item,
    subtotal: Number(item.subtotal) || 0,
    listPrice: item.listPrice || "",
  }));
  const totalAmount = items.reduce((sum: number, item: any) => sum + item.subtotal, 0);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">ALE 报价单</h1>
          <p className="text-sm text-muted-foreground mt-1">{quotation.quotationNo}</p>
        </div>
        <Badge variant="outline" className={`text-xs ${QUOTATION_STATUS_COLORS[quotation.status] || ""}`}>
          {QUOTATION_STATUS_LABELS[quotation.status] || quotation.status}
        </Badge>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">客户信息</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <div><span className="text-muted-foreground">客户名称：</span>{quotation.customerName}</div>
            {quotation.customerContact && <div><span className="text-muted-foreground">联系人：</span>{quotation.customerContact}</div>}
            {quotation.customerPhone && <div><span className="text-muted-foreground">电话：</span>{quotation.customerPhone}</div>}
            {quotation.projectName && <div><span className="text-muted-foreground">项目名称：</span>{quotation.projectName}</div>}
            {quotation.validUntil && <div><span className="text-muted-foreground">有效期：</span>{new Date(quotation.validUntil).toLocaleDateString("zh-CN")}</div>}
            {quotation.discountRate && Number(quotation.discountRate) > 0 && (
              <div><span className="text-muted-foreground">折扣率：</span>{quotation.discountRate}%</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">报价明细</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-3 py-2 text-left font-semibold text-xs">#</th>
                <th className="px-3 py-2 text-left font-semibold text-xs">产品型号</th>
                <th className="px-3 py-2 text-left font-semibold text-xs">产品说明</th>
                <th className="px-3 py-2 text-right font-semibold text-xs">媒体价(¥)</th>
                <th className="px-3 py-2 text-right font-semibold text-xs">数量</th>
                <th className="px-3 py-2 text-right font-semibold text-xs">折扣(%)</th>
                <th className="px-3 py-2 text-right font-semibold text-xs">小计(¥)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any, idx: number) => (
                <tr key={idx} className="border-b border-border/50">
                  <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                  <td className="px-3 py-2 font-medium">{item.productModel}</td>
                  <td className="px-3 py-2 text-muted-foreground">{item.productDesc}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{item.listPrice ? `¥${Number(item.listPrice).toLocaleString()}` : "-"}</td>
                  <td className="px-3 py-2 text-right">{item.quantity}</td>
                  <td className="px-3 py-2 text-right">{item.discountRate || 0}%</td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">¥{item.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-end mt-4 pt-3 border-t">
            <div className="text-right">
              <span className="text-sm text-muted-foreground">合计金额：</span>
              <span className="text-lg font-bold text-primary tabular-nums ml-2">
                ¥{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {quotation.notes && (
        <Card>
          <CardContent className="p-4">
            <span className="text-sm text-muted-foreground">备注：</span>
            <span className="text-sm ml-2">{quotation.notes}</span>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
