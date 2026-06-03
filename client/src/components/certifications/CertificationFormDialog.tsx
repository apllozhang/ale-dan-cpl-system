import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { CERT_PRODUCT_CATEGORIES, CERT_STANDARD_TYPES } from "@shared/const";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  certType: "product" | "enterprise";
  editId?: number | null;
  readOnly?: boolean;
}

const STATUS_OPTIONS = ["active", "expired", "revoked", "pending"];

interface CertForm {
  certNo: string;
  certName: string;
  standardType: string;
  productCategory: string;
  productSeries: string;
  issuer: string;
  holder: string;
  factoryNo: string;
  testReportNo: string;
  certScope: string;
  issueDate: string;
  expiryDate: string;
  status: string;
  remark: string;
  productModelsStr: string;
}

const EMPTY_FORM: CertForm = {
  certNo: "", certName: "", standardType: "", productCategory: "", productSeries: "",
  issuer: "", holder: "", factoryNo: "", testReportNo: "", certScope: "",
  issueDate: "", expiryDate: "", status: "active", remark: "", productModelsStr: "",
};

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function CertificationFormDialog({ open, onClose, onSave, certType, editId, readOnly }: Props) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  const [form, setForm] = useState<CertForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof CertForm, string>>>({});

  const { data: existing, isLoading: loadingExisting } = trpc.certifications.getById.useQuery(
    { id: editId! },
    { enabled: !!editId && open }
  );

  useEffect(() => {
    if (existing) {
      setForm({
        certNo: existing.certNo,
        certName: existing.certName,
        standardType: existing.standardType ?? "",
        productCategory: existing.productCategory ?? "",
        productSeries: existing.productSeries ?? "",
        issuer: existing.issuer,
        holder: existing.holder,
        factoryNo: existing.factoryNo ?? "",
        testReportNo: existing.testReportNo ?? "",
        certScope: existing.certScope ?? "",
        issueDate: existing.issueDate,
        expiryDate: existing.expiryDate ?? "",
        status: existing.status,
        remark: existing.remark ?? "",
        productModelsStr: existing.productModels?.join(", ") ?? "",
      });
    } else if (!editId && open) {
      setForm(EMPTY_FORM);
    }
    setErrors({});
  }, [existing, editId, open]);

  const createMut = trpc.certifications.create.useMutation({
    onSuccess: () => { utils.certifications.list.invalidate(); onSave(); toast.success(t("common.success")); },
    onError: (e) => toast.error(e.message),
  });

  const updateMut = trpc.certifications.update.useMutation({
    onSuccess: () => { utils.certifications.list.invalidate(); onSave(); toast.success(t("common.success")); },
    onError: (e) => toast.error(e.message),
  });

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof CertForm, string>> = {};
    if (!form.certNo.trim()) newErrors.certNo = t("common.required");
    if (!form.certName.trim()) newErrors.certName = t("common.required");
    if (!form.issuer.trim()) newErrors.issuer = t("common.required");
    if (!form.holder.trim()) newErrors.holder = t("common.required");
    if (!form.issueDate) {
      newErrors.issueDate = t("common.required");
    } else if (!DATE_REGEX.test(form.issueDate)) {
      newErrors.issueDate = "YYYY-MM-DD";
    }
    if (form.expiryDate && !DATE_REGEX.test(form.expiryDate)) {
      newErrors.expiryDate = "YYYY-MM-DD";
    }
    if (certType === "product") {
      const models = form.productModelsStr.split(/[,;，；]/).map(s => s.trim()).filter(Boolean);
      if (models.length === 0) newErrors.productModelsStr = t("common.required");
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    const productModels = certType === "product"
      ? form.productModelsStr.split(/[,;，；]/).map(s => s.trim()).filter(Boolean)
      : undefined;

    const status = form.status as "active" | "expired" | "revoked" | "pending";
    const standardType = form.standardType ? form.standardType as typeof CERT_STANDARD_TYPES[number] : undefined;
    const productCategory = form.productCategory ? form.productCategory as typeof CERT_PRODUCT_CATEGORIES[number] : undefined;
    const payload = {
      certType,
      certNo: form.certNo,
      certName: form.certName,
      standardType,
      productCategory,
      productSeries: form.productSeries || undefined,
      issuer: form.issuer,
      holder: form.holder,
      factoryNo: form.factoryNo || undefined,
      testReportNo: form.testReportNo || undefined,
      certScope: form.certScope || undefined,
      issueDate: form.issueDate,
      expiryDate: form.expiryDate || undefined,
      status,
      remark: form.remark || undefined,
      productModels,
    };

    if (editId) {
      updateMut.mutate({ id: editId, ...payload });
    } else {
      createMut.mutate(payload);
    }
  };

  const saving = createMut.isPending || updateMut.isPending;
  const title = readOnly
    ? t("certifications.actions.view")
    : editId
      ? t("certifications.actions.edit")
      : t("certifications.actions.add");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {loadingExisting ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div>
                <Label htmlFor="certNo">{t("certifications.fields.certNo")} *</Label>
                <Input id="certNo" value={form.certNo} onChange={e => setForm(f => ({ ...f, certNo: e.target.value }))} disabled={readOnly} />
                {errors.certNo && <p className="text-xs text-destructive mt-1">{errors.certNo}</p>}
              </div>
              <div>
                <Label htmlFor="certName">{t("certifications.fields.certName")} *</Label>
                <Input id="certName" value={form.certName} onChange={e => setForm(f => ({ ...f, certName: e.target.value }))} disabled={readOnly} />
                {errors.certName && <p className="text-xs text-destructive mt-1">{errors.certName}</p>}
              </div>
              {certType === "product" && (
                <div>
                  <Label htmlFor="standardType">{t("certifications.fields.standardType")}</Label>
                  <Select value={form.standardType} onValueChange={v => setForm(f => ({ ...f, standardType: v }))} disabled={readOnly}>
                    <SelectTrigger id="standardType"><SelectValue placeholder={t("certifications.filters.allStandards")} /></SelectTrigger>
                    <SelectContent>
                      {CERT_STANDARD_TYPES.map(s => <SelectItem key={s} value={s}>{t(`certifications.standards.${s}`)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {certType === "product" && (
                <div>
                  <Label htmlFor="productCategory">{t("certifications.fields.productCategory")}</Label>
                  <Select value={form.productCategory} onValueChange={v => setForm(f => ({ ...f, productCategory: v }))} disabled={readOnly}>
                    <SelectTrigger id="productCategory"><SelectValue placeholder={t("certifications.filters.allCategories")} /></SelectTrigger>
                    <SelectContent>
                      {CERT_PRODUCT_CATEGORIES.map(c => <SelectItem key={c} value={c}>{t(`certifications.categories.${c}`)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {certType === "product" && (
                <div>
                  <Label htmlFor="productSeries">{t("certifications.fields.productSeries")}</Label>
                  <Input id="productSeries" value={form.productSeries} onChange={e => setForm(f => ({ ...f, productSeries: e.target.value }))} disabled={readOnly} />
                </div>
              )}
              <div>
                <Label htmlFor="issuer">{t("certifications.fields.issuer")} *</Label>
                <Input id="issuer" value={form.issuer} onChange={e => setForm(f => ({ ...f, issuer: e.target.value }))} disabled={readOnly} />
                {errors.issuer && <p className="text-xs text-destructive mt-1">{errors.issuer}</p>}
              </div>
              <div>
                <Label htmlFor="holder">{t("certifications.fields.holder")} *</Label>
                <Input id="holder" value={form.holder} onChange={e => setForm(f => ({ ...f, holder: e.target.value }))} disabled={readOnly} />
                {errors.holder && <p className="text-xs text-destructive mt-1">{errors.holder}</p>}
              </div>
              <div>
                <Label htmlFor="factoryNo">{t("certifications.fields.factoryNo")}</Label>
                <Input id="factoryNo" value={form.factoryNo} onChange={e => setForm(f => ({ ...f, factoryNo: e.target.value }))} disabled={readOnly} />
              </div>
              <div>
                <Label htmlFor="testReportNo">{t("certifications.fields.testReportNo")}</Label>
                <Input id="testReportNo" value={form.testReportNo} onChange={e => setForm(f => ({ ...f, testReportNo: e.target.value }))} disabled={readOnly} />
              </div>
              <div>
                <Label htmlFor="issueDate">{t("certifications.fields.issueDate")} *</Label>
                <Input id="issueDate" type="date" value={form.issueDate} onChange={e => setForm(f => ({ ...f, issueDate: e.target.value }))} disabled={readOnly} />
                {errors.issueDate && <p className="text-xs text-destructive mt-1">{errors.issueDate}</p>}
              </div>
              <div>
                <Label htmlFor="expiryDate">{t("certifications.fields.expiryDate")}</Label>
                <Input id="expiryDate" type="date" value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} disabled={readOnly} />
                {errors.expiryDate && <p className="text-xs text-destructive mt-1">{errors.expiryDate}</p>}
              </div>
              <div>
                <Label htmlFor="status">{t("certifications.fields.status")}</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))} disabled={readOnly}>
                  <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{t(`certifications.status.${s}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label htmlFor="certScope">{t("certifications.fields.certScope")}</Label>
                <Textarea id="certScope" value={form.certScope} onChange={e => setForm(f => ({ ...f, certScope: e.target.value }))} rows={2} disabled={readOnly} />
              </div>
              {certType === "product" && (
                <div className="col-span-2">
                  <Label htmlFor="productModels">{t("certifications.fields.productModels")} * ({t("certifications.import.selectType")})</Label>
                  <Textarea
                    id="productModels"
                    value={form.productModelsStr}
                    onChange={e => setForm(f => ({ ...f, productModelsStr: e.target.value }))}
                    placeholder={t("certifications.fields.productModelsPlaceholder")}
                    rows={2}
                    disabled={readOnly}
                  />
                  {errors.productModelsStr && <p className="text-xs text-destructive mt-1">{errors.productModelsStr}</p>}
                </div>
              )}
              <div className="col-span-2">
                <Label htmlFor="remark">{t("certifications.fields.remark")}</Label>
                <Textarea id="remark" value={form.remark} onChange={e => setForm(f => ({ ...f, remark: e.target.value }))} rows={2} disabled={readOnly} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>{readOnly ? t("common.close") : t("common.cancel")}</Button>
              {!readOnly && (
                <Button onClick={handleSubmit} disabled={saving}>
                  {saving ? t("common.loading") : t("common.save")}
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
