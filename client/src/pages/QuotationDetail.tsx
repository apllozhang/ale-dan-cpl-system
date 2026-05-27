import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useLocation, useRoute } from "wouter";
import {
  ArrowLeft, Save, Plus, Trash2, Loader2, Download,
  Send, CheckCircle, CheckCircle2, Mail, XCircle, Share2, Copy,
} from "lucide-react";
import { toast } from "sonner";
import { QUOTATION_STATUS_LABELS, QUOTATION_STATUS_COLORS, QUOTATION_STATUS_TRANSITIONS } from "@shared/const";
import { exportQuotationToExcelPro } from "@/lib/quotationExportPro";
import ProductSelectorDialog from "@/components/ProductSelectorDialog";

type ItemRow = {
  productId?: number;
  productModel: string;
  productDesc: string;
  listPrice: string;
  quantity: number;
  discountRate: number;
  subtotal: number;
};

const STATUS_ICONS: Record<string, any> = {
  submitted: Send,
  approved: CheckCircle,
  sent: Mail,
  completed: CheckCircle2,
  cancelled: XCircle,
};

const INDUSTRY_OPTIONS = [
  "教育", "酒店", "SMB中小企业", "企业", "医疗/康养",
  "制造业", "交通", "能源", "运营商", "政府",
  "公共事业", "渠道分销", "其它",
];

// Column definitions for resizable quotation table
const Q_COLS = [
  { key: "idx", label: "#", width: 40, minWidth: 32 },
  { key: "model", label: "产品型号", width: 160, minWidth: 80 },
  { key: "desc", label: "产品说明", width: 280, minWidth: 100 },
  { key: "price", label: "媒体价", width: 110, minWidth: 70 },
  { key: "qty", label: "数量", width: 80, minWidth: 60 },
  { key: "disc", label: "折扣(%)", width: 90, minWidth: 60 },
  { key: "sub", label: "小计", width: 120, minWidth: 80 },
  { key: "act", label: "", width: 40, minWidth: 36 },
];

function useColWidths(cols: typeof Q_COLS) {
  const [widths, setWidths] = useState(() => cols.map(c => c.width));
  const dragRef = useRef<{ index: number; startX: number; startWidth: number } | null>(null);

  const startResize = useCallback((index: number, e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { index, startX: e.clientX, startWidth: widths[index] };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = ev.clientX - dragRef.current.startX;
      const next = Math.max(cols[dragRef.current.index].minWidth, dragRef.current.startWidth + delta);
      setWidths(prev => { const c = [...prev]; c[dragRef.current!.index] = next; return c; });
    };
    const onUp = () => {
      dragRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [widths, cols]);

  return { widths, startResize };
}

function QuotationItemsTable({
  items,
  onUpdate,
  onRemove,
}: {
  items: ItemRow[];
  onUpdate: (index: number, field: keyof ItemRow, value: any) => void;
  onRemove: (index: number) => void;
}) {
  const { widths, startResize } = useColWidths(Q_COLS);

  return (
    <div className="overflow-x-auto">
      <table className="w-full" style={{ tableLayout: "fixed" }}>
        <thead>
          <tr className="bg-muted/30">
            {Q_COLS.map((col, i) => (
              <th
                key={col.key}
                className={`relative text-xs font-semibold px-3 py-2 text-left border-l border-border ${col.key === "sub" ? "text-right" : ""}`}
                style={{ width: widths[i] }}
              >
                {col.label}
                {col.key !== "act" && (
                  <span
                    className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/30 z-10"
                    onMouseDown={e => startResize(i, e)}
                  />
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx} className="border-b border-border/50 hover:bg-accent/20">
              <td className="px-2 py-1.5 text-xs text-muted-foreground border-l border-border" style={{ width: widths[0] }}>
                {idx + 1}
              </td>
              <td className="px-3 py-1.5 text-xs font-medium border-l border-border" style={{ width: widths[1] }}>
                {item.productModel}
              </td>
              <td className="px-3 py-1.5 text-xs text-muted-foreground border-l border-border" style={{ width: widths[2] }}>
                {item.productDesc}
              </td>
              <td className="px-3 py-1.5 text-xs tabular-nums border-l border-border" style={{ width: widths[3] }}>
                {item.listPrice ? `¥${Number(item.listPrice).toLocaleString()}` : "-"}
              </td>
              <td className="px-3 py-1.5 border-l border-border" style={{ width: widths[4] }}>
                <Input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={e => onUpdate(idx, "quantity", Math.max(1, parseInt(e.target.value) || 1))}
                  className="h-7 w-16 text-xs text-right"
                />
              </td>
              <td className="px-3 py-1.5 border-l border-border" style={{ width: widths[5] }}>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={item.discountRate}
                  onChange={e => onUpdate(idx, "discountRate", parseFloat(e.target.value) || 0)}
                  className="h-7 w-16 text-xs text-right"
                />
              </td>
              <td className="px-3 py-1.5 text-xs text-right font-medium tabular-nums border-l border-border" style={{ width: widths[6] }}>
                ¥{item.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td className="px-2 py-1.5 border-l border-border" style={{ width: widths[7] }}>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => onRemove(idx)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function QuotationDetail() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/quotations/:id");
  const { user } = useAuth();

  const isNew = !params?.id || params.id === "new";
  const quotationId = isNew ? null : Number(params?.id);

  // Form state
  const [customerName, setCustomerName] = useState("");
  const [salesContact, setSalesContact] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [industry, setIndustry] = useState("");
  const [projectName, setProjectName] = useState("");
  const [discountRate, setDiscountRate] = useState(0);
  const [notes, setNotes] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [items, setItems] = useState<ItemRow[]>([]);
  const [productSearchOpen, setProductSearchOpen] = useState(false);

  // Load existing quotation
  const quotationQuery = trpc.quotations.getById.useQuery(
    { id: quotationId! },
    { enabled: !!quotationId }
  );

  // Load quotation data
  useEffect(() => {
    if (quotationQuery.data) {
      const q = quotationQuery.data;
      setCustomerName(q.customerName || "");
      setSalesContact(q.customerContact || "");
      setCustomerPhone(q.customerPhone || "");
      setIndustry(q.industry || "");
      setProjectName(q.projectName || "");
      setDiscountRate(Number(q.discountRate) || 0);
      setNotes(q.notes || "");
      setValidUntil(q.validUntil ? new Date(q.validUntil).toISOString().slice(0, 10) : "");
      setItems((q.items || []).map((item: any) => ({
        productId: item.productId,
        productModel: item.productModel || "",
        productDesc: item.productDesc || "",
        listPrice: item.listPrice || "",
        quantity: item.quantity || 1,
        discountRate: Number(item.discountRate) || 0,
        subtotal: Number(item.subtotal) || 0,
      })));
    }
  }, [quotationQuery.data]);

  const updateItem = (index: number, field: keyof ItemRow, value: any) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const updated = { ...item, [field]: value };
      const price = parseFloat(updated.listPrice) || 0;
      const qty = field === "quantity" ? Number(value) : item.quantity;
      const disc = field === "discountRate" ? Number(value) : item.discountRate;
      updated.subtotal = price * qty * (1 - disc / 100);
      return updated;
    }));
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const existingProductIds = useMemo(() => {
    const ids = new Set<number>();
    items.forEach(item => { if (item.productId) ids.add(item.productId); });
    return ids;
  }, [items]);

  const handleAddProducts = (products: Array<{ product: any; quantity: number }>) => {
    const newItems: ItemRow[] = products.map(({ product, quantity }) => ({
      productId: product.id,
      productModel: product.productModel || "",
      productDesc: product.productDesc || "",
      listPrice: product.listPrice || "",
      quantity,
      discountRate: discountRate,
      subtotal: parseFloat(product.listPrice || "0") * quantity * (1 - discountRate / 100),
    }));
    setItems(prev => [...prev, ...newItems]);
  };

  const totalAmount = useMemo(() => {
    return items.reduce((sum, item) => sum + item.subtotal, 0);
  }, [items]);

  // Mutations
  const createMutation = trpc.quotations.create.useMutation();
  const updateMutation = trpc.quotations.update.useMutation();
  const statusMutation = trpc.quotations.updateStatus.useMutation();
  const shareMutation = trpc.sharing.share.useMutation();
  const templateCreateMutation = trpc.templates.create.useMutation();

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleSave = async () => {
    if (!customerName.trim()) {
      toast.error("请输入客户名称");
      return;
    }
    if (!projectName.trim()) {
      toast.error("请输入项目名称");
      return;
    }
    if (!salesContact.trim()) {
      toast.error("请输入销售联系人");
      return;
    }
    if (items.length === 0) {
      toast.error("请添加至少一个产品");
      return;
    }

    const payload = {
      customerName: customerName.trim(),
      customerContact: salesContact.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      industry: industry || undefined,
      projectName: projectName.trim(),
      discountRate,
      notes: notes.trim() || undefined,
      validUntil: validUntil || undefined,
      items: items.map(item => ({
        productId: item.productId,
        productModel: item.productModel,
        productDesc: item.productDesc || undefined,
        listPrice: item.listPrice || undefined,
        quantity: item.quantity,
        unitPrice: parseFloat(item.listPrice) || 0,
        discountRate: item.discountRate,
      })),
    };

    try {
      if (isNew) {
        const result = await createMutation.mutateAsync(payload) as any;
        toast.success("报价单已创建");
        if (result?.id) {
          setLocation(`/quotations/${result.id}`);
        }
      } else {
        await updateMutation.mutateAsync({ id: quotationId!, ...payload });
        toast.success("报价单已更新");
        quotationQuery.refetch();
      }
    } catch (err: any) {
      toast.error(err.message || "保存失败");
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!quotationId) return;
    try {
      await statusMutation.mutateAsync({ id: quotationId, status: newStatus as any });
      toast.success(`状态已更新为 ${QUOTATION_STATUS_LABELS[newStatus]}`);
      quotationQuery.refetch();
    } catch (err: any) {
      toast.error(err.message || "状态更新失败");
    }
  };

  const handleExport = async () => {
    if (!quotationQuery.data) return;
    await exportQuotationToExcelPro(quotationQuery.data, items);
  };

  const handleShare = async () => {
    if (!quotationId) return;
    try {
      const result = await shareMutation.mutateAsync({ id: quotationId });
      const url = `${window.location.origin}/share/${result.shareToken}`;
      await navigator.clipboard.writeText(url);
      toast.success("分享链接已复制到剪贴板");
    } catch (err: any) {
      toast.error(err.message || "分享失败");
    }
  };

  const handleSaveTemplate = async () => {
    const name = prompt("请输入模板名称:");
    if (!name) return;
    try {
      await templateCreateMutation.mutateAsync({
        name,
        items: JSON.stringify(items),
        discountRate,
        notes,
      });
      toast.success("模板已保存");
    } catch (err: any) {
      toast.error(err.message || "保存模板失败");
    }
  };

  const currentStatus = quotationQuery.data?.status || "draft";
  const transitions = QUOTATION_STATUS_TRANSITIONS[currentStatus] || [];
  const isLoadingQuotation = !!quotationId && quotationQuery.isLoading;

  if (isLoadingQuotation) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setLocation("/quotations")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">
            {isNew ? "新建报价单" : `报价单 ${quotationQuery.data?.quotationNo || ""}`}
          </h1>
          {!isNew && (
            <Badge variant="outline" className={`text-xs ${QUOTATION_STATUS_COLORS[currentStatus]}`}>
              {QUOTATION_STATUS_LABELS[currentStatus]}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isNew && transitions.map(status => {
            const Icon = STATUS_ICONS[status] || Send;
            return (
              <Button key={status} size="sm" variant="outline" onClick={() => handleStatusChange(status)} disabled={statusMutation.isPending}>
                <Icon className="w-4 h-4 mr-1" />
                {QUOTATION_STATUS_LABELS[status]}
              </Button>
            );
          })}
          {!isNew && (
            <Button size="sm" variant="outline" onClick={handleExport}>
              <Download className="w-4 h-4 mr-1" />
              导出 Excel
            </Button>
          )}
          {!isNew && (
            <Button size="sm" variant="outline" onClick={handleShare} disabled={shareMutation.isPending}>
              <Share2 className="w-4 h-4 mr-1" />
              分享
            </Button>
          )}
          {items.length > 0 && (
            <Button size="sm" variant="outline" onClick={handleSaveTemplate} disabled={templateCreateMutation.isPending}>
              <Copy className="w-4 h-4 mr-1" />
              存为模板
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            <Save className="w-4 h-4 mr-1" />
            保存
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto space-y-4">
        {/* Customer Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">客户信息</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">客户名称 <span className="text-destructive">*</span></Label>
                <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="请输入客户名称" className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">项目名称 <span className="text-destructive">*</span></Label>
                <Input value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="请输入项目名称" className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">报价有效期</Label>
                <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">销售联系人 <span className="text-destructive">*</span></Label>
                <Input value={salesContact} onChange={e => setSalesContact(e.target.value)} placeholder="请输入销售联系人" className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">行业</Label>
                <Select value={industry} onValueChange={setIndustry}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="请选择行业" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRY_OPTIONS.map(opt => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">联系电话</Label>
                <Input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="可选" className="h-9 text-sm" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quotation Items */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">报价明细</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setProductSearchOpen(true)} className="gap-1.5 h-8">
                <Plus className="w-3.5 h-3.5" />
                添加产品
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <p className="text-sm">暂无产品</p>
                <p className="text-xs mt-1">点击"添加产品"从产品目录中选择</p>
              </div>
            ) : (
              <QuotationItemsTable
                items={items}
                onUpdate={updateItem}
                onRemove={removeItem}
              />
            )}
          </CardContent>
        </Card>

        {/* Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">汇总信息</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">整单折扣率(%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={discountRate}
                  onChange={e => setDiscountRate(parseFloat(e.target.value) || 0)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">合计金额</Label>
                <div className="h-9 flex items-center text-lg font-bold tabular-nums text-primary">
                  ¥{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">备注</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="可选" className="min-h-[36px] text-sm" rows={1} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Product Selector Dialog */}
      <ProductSelectorDialog
        open={productSearchOpen}
        onOpenChange={setProductSearchOpen}
        onAddProducts={handleAddProducts}
        discountRate={discountRate}
        existingProductIds={existingProductIds}
      />
    </div>
  );
}
