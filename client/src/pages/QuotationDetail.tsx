import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useMemo } from "react";
import { useLocation, useRoute } from "wouter";
import {
  ArrowLeft, Save, Plus, Trash2, Loader2, Download,
  Send, CheckCircle, CheckCircle2, Mail, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { QUOTATION_STATUS_LABELS, QUOTATION_STATUS_COLORS, QUOTATION_STATUS_TRANSITIONS } from "@shared/const";
import { exportQuotationToExcel } from "@/lib/quotationExport";
import ProductSelectorDialog from "@/components/ProductSelectorDialog";

type ItemRow = {
  productId?: number;
  productModel: string;
  productDesc: string;
  listPrice: string;
  quantity: number;
  unitPrice: number;
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

export default function QuotationDetail() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/quotations/:id");
  const { user } = useAuth();

  const isNew = !params?.id || params.id === "new";
  const quotationId = isNew ? null : Number(params?.id);

  // Form state
  const [customerName, setCustomerName] = useState("");
  const [customerContact, setCustomerContact] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
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
      setCustomerContact(q.customerContact || "");
      setCustomerPhone(q.customerPhone || "");
      setCustomerEmail(q.customerEmail || "");
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
        unitPrice: Number(item.unitPrice) || 0,
        discountRate: Number(item.discountRate) || 0,
        subtotal: Number(item.subtotal) || 0,
      })));
    }
  }, [quotationQuery.data]);

  const updateItem = (index: number, field: keyof ItemRow, value: any) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const updated = { ...item, [field]: value };
      const unitPrice = field === "unitPrice" ? Number(value) : item.unitPrice;
      const qty = field === "quantity" ? Number(value) : item.quantity;
      const disc = field === "discountRate" ? Number(value) : item.discountRate;
      updated.subtotal = unitPrice * qty * (1 - disc / 100);
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
      unitPrice: parseFloat(product.listPrice || "0"),
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

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleSave = async () => {
    if (!customerName.trim()) {
      toast.error("请输入客户名称");
      return;
    }
    if (items.length === 0) {
      toast.error("请添加至少一个产品");
      return;
    }

    const payload = {
      customerName: customerName.trim(),
      customerContact: customerContact.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      customerEmail: customerEmail.trim() || undefined,
      projectName: projectName.trim() || undefined,
      discountRate,
      notes: notes.trim() || undefined,
      validUntil: validUntil || undefined,
      items: items.map(item => ({
        productId: item.productId,
        productModel: item.productModel,
        productDesc: item.productDesc || undefined,
        listPrice: item.listPrice || undefined,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
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

  const handleExport = () => {
    if (!quotationQuery.data) return;
    exportQuotationToExcel(quotationQuery.data, items);
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
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            <Save className="w-4 h-4 mr-1" />
            {isNew ? "创建" : "保存"}
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
                <Label className="text-xs">客户名称 *</Label>
                <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="请输入客户名称" className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">联系人</Label>
                <Input value={customerContact} onChange={e => setCustomerContact(e.target.value)} placeholder="可选" className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">电话</Label>
                <Input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="可选" className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">邮箱</Label>
                <Input value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="可选" className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">项目名称</Label>
                <Input value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="可选" className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">有效期</Label>
                <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="h-9 text-sm" />
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
              <div className="overflow-x-auto">
                <Table style={{ width: "max-content", minWidth: "100%" }}>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="text-xs font-semibold w-10">#</TableHead>
                      <TableHead className="text-xs font-semibold min-w-[140px]">产品型号</TableHead>
                      <TableHead className="text-xs font-semibold min-w-[200px]">产品说明</TableHead>
                      <TableHead className="text-xs font-semibold w-24">媒体价</TableHead>
                      <TableHead className="text-xs font-semibold w-20">数量</TableHead>
                      <TableHead className="text-xs font-semibold w-24">单价</TableHead>
                      <TableHead className="text-xs font-semibold w-20">折扣(%)</TableHead>
                      <TableHead className="text-xs font-semibold w-28 text-right">小计</TableHead>
                      <TableHead className="text-xs font-semibold w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, idx) => (
                      <TableRow key={idx} className="hover:bg-accent/20">
                        <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="text-xs font-medium">{item.productModel}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">{item.productDesc}</TableCell>
                        <TableCell className="text-xs">{item.listPrice ? `¥${Number(item.listPrice).toLocaleString()}` : "-"}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={e => updateItem(idx, "quantity", Math.max(1, parseInt(e.target.value) || 1))}
                            className="h-8 w-16 text-xs text-right"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={item.unitPrice}
                            onChange={e => updateItem(idx, "unitPrice", parseFloat(e.target.value) || 0)}
                            className="h-8 w-20 text-xs text-right"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={item.discountRate}
                            onChange={e => updateItem(idx, "discountRate", parseFloat(e.target.value) || 0)}
                            className="h-8 w-16 text-xs text-right"
                          />
                        </TableCell>
                        <TableCell className="text-xs text-right font-medium tabular-nums">
                          ¥{item.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => removeItem(idx)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
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

<<<<<<< HEAD
      {/* Product Search Dialog */}
      <Dialog open={productSearchOpen} onOpenChange={setProductSearchOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>添加产品到报价单</DialogTitle>
          </DialogHeader>
          <div className="flex-1 flex flex-col gap-3 overflow-hidden">
            {/* Sheet selector */}
            <div className="flex gap-2 items-center flex-wrap">
              <span className="text-xs font-medium text-muted-foreground">产品系列:</span>
              <button
                onClick={() => setSelectedSheet(undefined)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  selectedSheet === undefined
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80"
                }`}
              >
                全部
              </button>
              {sheetsQuery.data?.map((sheet: any) => (
                <button
                  key={sheet.sheetName}
                  onClick={() => setSelectedSheet(sheet.sheetName)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    selectedSheet === sheet.sheetName
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80"
                  }`}
                >
                  {sheet.sheetName}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜索产品型号、说明..."
                value={productSearch}
                onChange={e => handleProductSearchChange(e.target.value)}
                className="pl-9 h-9 text-sm"
                autoFocus
              />
              {productSearch && (
                <button onClick={() => { setProductSearch(""); setProductSearchDebounced(""); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex-1 overflow-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="w-10 text-xs">
                      <input
                        type="checkbox"
                        checked={selectedProducts.size > 0 && selectedProducts.size === searchResults.length}
                        onChange={() => {
                          if (selectedProducts.size === searchResults.length) {
                            setSelectedProducts(new Set());
                          } else {
                            setSelectedProducts(new Set(searchResults.map((p: any) => p.id)));
                          }
                        }}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </TableHead>
                    <TableHead className="text-xs font-semibold">产品型号</TableHead>
                    <TableHead className="text-xs font-semibold">产品说明</TableHead>
                    <TableHead className="text-xs font-semibold">媒体价</TableHead>
                    <TableHead className="text-xs font-semibold">状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productSearchQuery.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32 text-center">
                        <Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : searchResults.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32 text-center text-muted-foreground text-sm">
                        {productSearchDebounced ? "未找到匹配产品" : "输入关键词搜索产品"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    searchResults.map((p: any) => (
                      <TableRow
                        key={p.id}
                        className={`cursor-pointer transition-colors ${selectedProducts.has(p.id) ? "bg-primary/10" : "hover:bg-accent/30"}`}
                        onClick={() => toggleProductSelection(p.id)}
                      >
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedProducts.has(p.id)}
                            onChange={() => toggleProductSelection(p.id)}
                            className="w-4 h-4 cursor-pointer"
                          />
                        </TableCell>
                        <TableCell className="text-xs font-medium">{p.productModel}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">{p.productDesc}</TableCell>
                        <TableCell className="text-xs">{p.listPrice ? `¥${Number(p.listPrice).toLocaleString()}` : "-"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                            {p.productStatus || "-"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter>
            <span className="text-xs text-muted-foreground mr-auto">
              已选择 {selectedProducts.size} 个产品
            </span>
            <Button variant="outline" onClick={() => { setProductSearchOpen(false); setSelectedProducts(new Set()); }}>取消</Button>
            <Button onClick={addSelectedProducts} disabled={selectedProducts.size === 0}>
              添加到报价
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
=======
      {/* Product Selector Dialog */}
      <ProductSelectorDialog
        open={productSearchOpen}
        onOpenChange={setProductSearchOpen}
        onAddProducts={handleAddProducts}
        discountRate={discountRate}
        existingProductIds={existingProductIds}
      />
>>>>>>> c7e2536 (feat: 网络架构分类产品选择弹窗 + Bug修复)
    </div>
  );
}
