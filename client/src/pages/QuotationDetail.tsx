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
  Send, CheckCircle, CheckCircle2, Mail, XCircle, Share2, Copy, Pencil,
  Search, Check, FileSpreadsheet, Printer,
} from "lucide-react";
import { toast } from "sonner";
import { QUOTATION_STATUS_LABELS, QUOTATION_STATUS_COLORS, QUOTATION_STATUS_TRANSITIONS } from "@shared/const";
import { exportQuotationToExcel } from "@/lib/quotationExport";
import ProductSelectorDialog from "@/components/ProductSelectorDialog";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  const { widths, startResize } = useColWidths(Q_COLS);

  const renderColLabel = useCallback((key: string, defaultLabel: string): string => {
    switch (key) {
      case "price": return t('quotation.listPrice');
      case "qty": return t('quotation.quantity');
      case "disc": return t('quotation.discountRate');
      case "sub": return t('quotation.subtotal');
      default: return defaultLabel;
    }
  }, [t]);

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
                {renderColLabel(col.key, col.label)}
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
  const { t } = useTranslation();
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
  const [editingIndustry, setEditingIndustry] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [discountRate, setDiscountRate] = useState(0);
  const [notes, setNotes] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [items, setItems] = useState<ItemRow[]>([]);
  const [productSearchOpen, setProductSearchOpen] = useState(false);

  // Quick search state
  const [quickSearch, setQuickSearch] = useState("");
  const [quickResults, setQuickResults] = useState<any[]>([]);
  const quickSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const quickSearchRef = useRef<HTMLDivElement>(null);

  // Total amount flash effect
  const prevTotalRef = useRef(0);
  const [totalFlash, setTotalFlash] = useState(false);

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
      updated.subtotal = price * qty * (disc / 100);
      return updated;
    }));
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const applyDiscountToAll = () => {
    setItems(prev => prev.map(item => ({
      ...item,
      discountRate,
      subtotal: parseFloat(item.listPrice || "0") * item.quantity * (discountRate / 100),
    })));
    toast.success("已将折扣率应用到所有行");
  };

  // Quick search: debounced product lookup
  const quickSearchQuery = trpc.cpl.products.useQuery(
    { search: quickSearch.trim(), page: 1, pageSize: 8 },
    { enabled: quickSearch.trim().length > 0 },
  );
  useEffect(() => {
    if (quickSearch.trim() && quickSearchQuery.data?.items) {
      setQuickResults(quickSearchQuery.data.items);
    } else if (!quickSearch.trim()) {
      setQuickResults([]);
    }
  }, [quickSearch, quickSearchQuery.data]);

  const handleQuickSearch = useCallback((text: string) => {
    setQuickSearch(text);
  }, []);

  const quickAdd = (product: any) => {
    if (existingProductIds.has(product.id)) {
      toast.info(`${product.productModel} 已在报价单中`);
      setQuickSearch("");
      setQuickResults([]);
      return;
    }
    const newItem: ItemRow = {
      productId: product.id,
      productModel: product.productModel || "",
      productDesc: product.productDesc || "",
      listPrice: product.listPrice || "",
      quantity: 1,
      discountRate,
      subtotal: parseFloat(product.listPrice || "0") * 1 * (discountRate / 100),
    };
    setItems(prev => [...prev, newItem]);
    setQuickSearch("");
    setQuickResults([]);
  };

  // Close quick search on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (quickSearchRef.current && !quickSearchRef.current.contains(e.target as Node)) {
        setQuickResults([]);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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
      subtotal: parseFloat(product.listPrice || "0") * quantity * (discountRate / 100),
    }));
    setItems(prev => [...prev, ...newItems]);
  };

  const totalAmount = useMemo(() => {
    return items.reduce((sum, item) => sum + item.subtotal, 0);
  }, [items]);

  // Flash total on change
  useEffect(() => {
    if (prevTotalRef.current !== totalAmount && prevTotalRef.current !== 0) {
      setTotalFlash(true);
      const timer = setTimeout(() => setTotalFlash(false), 400);
      return () => clearTimeout(timer);
    }
    prevTotalRef.current = totalAmount;
  }, [totalAmount]);

  // Mutations
  const createMutation = trpc.quotations.create.useMutation();
  const updateMutation = trpc.quotations.update.useMutation();
  const statusMutation = trpc.quotations.updateStatus.useMutation();
  const shareMutation = trpc.sharing.share.useMutation();
  const templateCreateMutation = trpc.templates.create.useMutation();

  const versionsQuery = trpc.versions.list.useQuery(
    { quotationId: quotationId! },
    { enabled: !isNew && !!quotationId }
  );

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleSave = async () => {
    if (!customerName.trim()) {
      toast.error(t('quotation.validateCustomer'));
      return;
    }
    if (!projectName.trim()) {
      toast.error(t('quotation.validateProject'));
      return;
    }
    if (!salesContact.trim()) {
      toast.error(t('quotation.validateContact'));
      return;
    }
    if (items.length === 0) {
      toast.error(t('quotation.validateItems'));
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
        toast.success(t('quotation.createSuccess'));
        if (result?.id) {
          setLocation(`/quotations/${result.id}`);
        }
      } else {
        await updateMutation.mutateAsync({ id: quotationId!, ...payload });
        toast.success(t('quotation.updateSuccess'));
        quotationQuery.refetch();
      }
    } catch (err: any) {
      toast.error(err.message || t('quotation.saveFailed'));
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!quotationId) return;
    try {
      await statusMutation.mutateAsync({ id: quotationId, status: newStatus as any });
      toast.success(t('quotation.statusUpdated', { status: QUOTATION_STATUS_LABELS[newStatus] }));
      quotationQuery.refetch();
    } catch (err: any) {
      toast.error(err.message || t('quotation.statusUpdateFailed'));
    }
  };

  const handleExport = async () => {
    if (!quotationQuery.data) return;
    await exportQuotationToExcel(quotationQuery.data, items);
  };

  const handleShare = async () => {
    if (!quotationId) return;
    try {
      const result = await shareMutation.mutateAsync({ id: quotationId });
      const url = `${window.location.origin}/share/${result.shareToken}`;
      await navigator.clipboard.writeText(url);
      toast.success(t('quotation.shareCopied'));
    } catch (err: any) {
      toast.error(err.message || t('quotation.shareFailed'));
    }
  };

  const handleSaveTemplate = async () => {
    const name = prompt(t('quotation.templateNamePrompt'));
    if (!name) return;
    try {
      await templateCreateMutation.mutateAsync({
        name,
        items: JSON.stringify(items),
        discountRate,
        notes,
      });
      toast.success(t('quotation.templateSaved'));
    } catch (err: any) {
      toast.error(err.message || t('quotation.templateSaveFailed'));
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
            {isNew ? t('quotation.newTitle') : t('quotation.detailTitle', { no: quotationQuery.data?.quotationNo || "" })}
          </h1>
          {!isNew && (
            <Badge variant="outline" className={`text-xs ${QUOTATION_STATUS_COLORS[currentStatus]}`}>
              {QUOTATION_STATUS_LABELS[currentStatus]}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
              {t('quotation.exportExcel')}
            </Button>
          )}
          {!isNew && (
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-1" />
              {t('quotation.exportPDF', '导出PDF')}
            </Button>
          )}
          {!isNew && (
            <Button size="sm" variant="outline" onClick={handleShare} disabled={shareMutation.isPending}>
              <Share2 className="w-4 h-4 mr-1" />
              {t('quotation.share')}
            </Button>
          )}
          {items.length > 0 && (
            <Button size="sm" variant="outline" onClick={handleSaveTemplate} disabled={templateCreateMutation.isPending}>
              <Copy className="w-4 h-4 mr-1" />
              {t('quotation.saveTemplate')}
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            <Save className="w-4 h-4 mr-1" />
            {t('quotation.save')}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto space-y-4">
        {/* Customer Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">{t('quotation.customerInfo')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">{t('quotation.customerName')} <span className="text-destructive">*</span></Label>
                <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder={t('quotation.customerNamePlaceholder')} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('quotation.projectName')} <span className="text-destructive">*</span></Label>
                <Input value={projectName} onChange={e => setProjectName(e.target.value)} placeholder={t('quotation.projectNamePlaceholder')} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('quotation.validUntil')}</Label>
                <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('quotation.customerContact')} <span className="text-destructive">*</span></Label>
                <Input value={salesContact} onChange={e => setSalesContact(e.target.value)} placeholder={t('quotation.salesContactPlaceholder')} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('quotation.industry')}</Label>
                {industry && !editingIndustry ? (
                  <div className="flex items-center gap-1.5 h-9">
                    <span className="flex-1 px-3 py-1.5 bg-muted rounded-md text-sm font-medium">{industry}</span>
                    <Button variant="ghost" size="sm" className="h-9 px-2 text-muted-foreground hover:text-primary" onClick={() => setEditingIndustry(true)} title="修改行业">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <Select value={industry} onValueChange={v => { setIndustry(v); setEditingIndustry(false); }}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder={t('quotation.industryPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {INDUSTRY_OPTIONS.map(opt => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('quotation.customerPhone')}</Label>
                <Input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder={t('quotation.phoneOptional')} className="h-9 text-sm" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quotation Items */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">{t('quotation.items')}</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setProductSearchOpen(true)} className="gap-1.5 h-8">
                <Plus className="w-3.5 h-3.5" />
                {t('quotation.addProduct')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Quick search bar */}
            <div className="relative mb-3" ref={quickSearchRef}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="搜索产品型号快速添加..."
                  value={quickSearch}
                  onChange={e => handleQuickSearch(e.target.value)}
                  className="h-9 pl-9 text-sm"
                />
              </div>
              {quickResults.length > 0 && (
                <div className="absolute z-50 top-10 left-0 right-0 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
                  {quickResults.map((product: any) => (
                    <button
                      key={product.id}
                      onClick={() => quickAdd(product)}
                      className="w-full px-3 py-2 text-left hover:bg-accent/30 flex items-center justify-between gap-2 border-b border-border/50 last:border-0"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-medium">{product.productModel}</span>
                        <span className="text-xs text-muted-foreground ml-2 truncate">{product.productDesc}</span>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        ¥{Number(product.listPrice || 0).toLocaleString()}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {items.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                  <FileSpreadsheet className="w-7 h-7 text-primary/40" />
                </div>
                <p className="text-sm font-medium mt-4">{t('quotation.noItems')}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('quotation.noItemsHint')}</p>
                <Button size="sm" variant="outline" className="mt-3" onClick={() => setProductSearchOpen(true)}>
                  <Plus className="w-4 h-4 mr-1" />
                  {t('quotation.addProduct')}
                </Button>
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
            <CardTitle className="text-sm font-medium">{t('quotation.summary')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">{t('quotation.overallDiscount')}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={discountRate}
                    onChange={e => setDiscountRate(parseFloat(e.target.value) || 0)}
                    className="h-9 text-sm flex-1"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={applyDiscountToAll}
                    className="h-9 px-2 shrink-0"
                    title="应用到所有行"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('quotation.totalAmount')}</Label>
                <div className={`h-9 flex items-center text-lg font-bold tabular-nums transition-colors duration-300 ${totalFlash ? "text-info" : "text-primary"}`}>
                  ¥{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('quotation.notes')}</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('common.optional')} className="min-h-[36px] text-sm" rows={1} />
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

      {/* Version Timeline */}
      {!isNew && versionsQuery.data && versionsQuery.data.length > 0 && (
        <VersionTimeline
          versions={versionsQuery.data}
          quotationId={quotationId!}
        />
      )}
    </div>
  );
}

// ==================== Version Timeline Component ====================
function VersionTimeline({ versions, quotationId }: { versions: any[]; quotationId: number }) {
  const { t } = useTranslation();
  const [diffData, setDiffData] = useState<any>(null);
  const [comparing, setComparing] = useState(false);
  const [selectedFrom, setSelectedFrom] = useState<number | null>(null);
  const [selectedTo, setSelectedTo] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  const handleCompare = async () => {
    if (!selectedFrom || !selectedTo) return;
    setComparing(true);
    try {
      const from = Math.min(selectedFrom, selectedTo);
      const to = Math.max(selectedFrom, selectedTo);
      const trpcUrl = `/api/trpc/versions.diff?input=${encodeURIComponent(JSON.stringify({ json: { quotationId, fromVersion: from, toVersion: to } }))}`;
      const res = await fetch(trpcUrl);
      const data = await res.json();
      setDiffData(data?.result?.data?.json ?? null);
    } catch {
      setDiffData(null);
    }
    setComparing(false);
  };

  const displayed = expanded ? versions : versions.slice(0, 3);

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            版本记录 (共{versions.length}个版本)
          </CardTitle>
          <svg className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0">
          <div className="relative ml-4 pl-6 border-l-2 border-muted">
            {displayed.map((v: any, i: number) => (
              <div key={v.id} className="relative pb-4 last:pb-0">
                <div className={`absolute -left-[29px] top-1 w-3 h-3 rounded-full border-2 ${i === 0 ? "bg-primary border-primary" : "bg-background border-muted-foreground/40"}`} />
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">V{v.version}</span>
                      <span className="text-xs text-muted-foreground">{v.createdAt ? new Date(v.createdAt).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}</span>
                      {v.itemCount > 0 && <span className="text-xs text-muted-foreground">{v.itemCount}项</span>}
                      {v.totalAmount && <span className="text-xs font-medium">¥{Number(v.totalAmount).toLocaleString()}</span>}
                    </div>
                    {v.changeSummary && (
                      <p className="text-xs text-muted-foreground mt-0.5">{v.changeSummary}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <input type="radio" name="fromVersion" checked={selectedFrom === v.version}
                      onChange={() => { setSelectedFrom(v.version); if (!selectedTo || selectedTo === v.version) setSelectedTo(null); }}
                      className="w-3 h-3 cursor-pointer" title="起始版本" />
                    <input type="radio" name="toVersion" checked={selectedTo === v.version}
                      onChange={() => { setSelectedTo(v.version); if (!selectedFrom || selectedFrom === v.version) setSelectedFrom(null); }}
                      className="w-3 h-3 cursor-pointer" title="目标版本" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {selectedFrom && selectedTo && (
            <div className="mt-3 pt-3 border-t flex items-center gap-2">
              <span className="text-xs text-muted-foreground">对比 V{Math.min(selectedFrom, selectedTo)} → V{Math.max(selectedFrom, selectedTo)}</span>
              <Button size="sm" onClick={handleCompare} disabled={comparing} className="h-7 text-xs gap-1">
                {comparing ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                查看差异
              </Button>
            </div>
          )}

          {diffData && (
            <div className="mt-3 pt-3 border-t">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">V{diffData.fromVersion} → V{diffData.toVersion} 变更明细</span>
                <button onClick={() => setDiffData(null)} className="text-xs text-muted-foreground hover:text-foreground">关闭</button>
              </div>
              <div className="flex items-center gap-4 mb-2 text-xs">
                <span>V{diffData.fromVersion}: ¥{Number(diffData.fromTotal).toLocaleString()}</span>
                <span>→</span>
                <span>V{diffData.toVersion}: ¥{Number(diffData.toTotal).toLocaleString()}</span>
                {diffData.fromTotal !== diffData.toTotal && (
                  <span className={Number(diffData.toTotal) > Number(diffData.fromTotal) ? "text-success" : "text-destructive"}>
                    {Number(diffData.toTotal) > Number(diffData.fromTotal) ? "+" : ""}¥{(Number(diffData.toTotal) - Number(diffData.fromTotal)).toLocaleString()}
                  </span>
                )}
              </div>
              <div className="overflow-auto max-h-[300px]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="px-2 py-1.5 text-left font-semibold">状态</th>
                      <th className="px-2 py-1.5 text-left font-semibold">产品型号</th>
                      <th className="px-2 py-1.5 text-right font-semibold">数量</th>
                      <th className="px-2 py-1.5 text-right font-semibold">折扣</th>
                      <th className="px-2 py-1.5 text-right font-semibold">小计</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diffData.items.map((item: any, i: number) => {
                      const cs: Record<string, string> = {
                        added: "bg-success-soft text-success",
                        removed: "bg-destructive/10 text-destructive",
                        modified: "bg-warning-soft text-warning",
                        unchanged: "",
                      };
                      const cl: Record<string, string> = { added: "新增", removed: "删除", modified: "变更", unchanged: "-" };
                      return (
                        <tr key={i} className={`border-b border-border/50 ${cs[item.change]}`}>
                          <td className="px-2 py-1 font-medium">{cl[item.change]}</td>
                          <td className="px-2 py-1">{item.productModel}</td>
                          <td className="px-2 py-1 text-right tabular-nums">
                            {item.before?.quantity ?? "-"}{item.change === "modified" && item.before?.quantity !== item.after?.quantity ? `→${item.after?.quantity}` : ""}
                          </td>
                          <td className="px-2 py-1 text-right tabular-nums">
                            {item.before?.discountRate ?? "-"}{item.change === "modified" ? `→${item.after?.discountRate ?? "-"}` : ""}
                          </td>
                          <td className="px-2 py-1 text-right tabular-nums">
                            {item.before?.subtotal ? `¥${Number(item.before.subtotal).toLocaleString()}` : "-"}
                            {item.change === "modified" ? `→¥${Number(item.after?.subtotal ?? 0).toLocaleString()}` : item.after?.subtotal ? `¥${Number(item.after.subtotal).toLocaleString()}` : ""}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
