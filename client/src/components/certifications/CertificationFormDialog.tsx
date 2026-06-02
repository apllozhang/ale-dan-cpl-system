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

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  certType: "product" | "enterprise";
  editId?: number | null;
}

const STATUS_OPTIONS = ["active", "expired", "revoked", "pending"];
const STANDARD_TYPES = ["CCC", "CE", "FCC", "UL", "RoHS", "REACH", "WEEE"];

interface CertForm {
  certNo: string;
  certName: string;
  standardType: string;
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
  certNo: "", certName: "", standardType: "", issuer: "", holder: "",
  factoryNo: "", testReportNo: "", certScope: "", issueDate: "", expiryDate: "",
  status: "active", remark: "", productModelsStr: "",
};

export function CertificationFormDialog({ open, onClose, onSave, certType, editId }: Props) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  const [form, setForm] = useState<CertForm>(EMPTY_FORM);

  const { data: existing } = trpc.certifications.getById.useQuery(
    { id: editId! },
    { enabled: !!editId }
  );

  useEffect(() => {
    if (existing) {
      setForm({
        certNo: existing.certNo,
        certName: existing.certName,
        standardType: existing.standardType ?? "",
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
    } else if (!editId) {
      setForm(EMPTY_FORM);
    }
  }, [existing, editId]);

  const createMut = trpc.certifications.create.useMutation({
    onSuccess: () => { utils.certifications.list.invalidate(); onSave(); toast.success(t("common.success")); },
    onError: (e) => toast.error(e.message),
  });

  const updateMut = trpc.certifications.update.useMutation({
    onSuccess: () => { utils.certifications.list.invalidate(); onSave(); toast.success(t("common.success")); },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = () => {
    const productModels = certType === "product"
      ? form.productModelsStr.split(/[,;，；]/).map(s => s.trim()).filter(Boolean)
      : undefined;

    const payload = {
      certType,
      certNo: form.certNo,
      certName: form.certName,
      standardType: form.standardType || undefined,
      issuer: form.issuer,
      holder: form.holder,
      factoryNo: form.factoryNo || undefined,
      testReportNo: form.testReportNo || undefined,
      certScope: form.certScope || undefined,
      issueDate: form.issueDate,
      expiryDate: form.expiryDate || undefined,
      status: form.status,
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

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editId ? t("certifications.actions.edit") : t("certifications.actions.add")}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-4">
          <div>
            <Label>{t("certifications.fields.certNo")} *</Label>
            <Input value={form.certNo} onChange={e => setForm(f => ({ ...f, certNo: e.target.value }))} />
          </div>
          <div>
            <Label>{t("certifications.fields.certName")} *</Label>
            <Input value={form.certName} onChange={e => setForm(f => ({ ...f, certName: e.target.value }))} />
          </div>
          {certType === "product" && (
            <div>
              <Label>{t("certifications.fields.standardType")}</Label>
              <Select value={form.standardType} onValueChange={v => setForm(f => ({ ...f, standardType: v }))}>
                <SelectTrigger><SelectValue placeholder={t("certifications.filters.allStandards")} /></SelectTrigger>
                <SelectContent>
                  {STANDARD_TYPES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>{t("certifications.fields.issuer")} *</Label>
            <Input value={form.issuer} onChange={e => setForm(f => ({ ...f, issuer: e.target.value }))} />
          </div>
          <div>
            <Label>{t("certifications.fields.holder")} *</Label>
            <Input value={form.holder} onChange={e => setForm(f => ({ ...f, holder: e.target.value }))} />
          </div>
          <div>
            <Label>{t("certifications.fields.factoryNo")}</Label>
            <Input value={form.factoryNo} onChange={e => setForm(f => ({ ...f, factoryNo: e.target.value }))} />
          </div>
          <div>
            <Label>{t("certifications.fields.testReportNo")}</Label>
            <Input value={form.testReportNo} onChange={e => setForm(f => ({ ...f, testReportNo: e.target.value }))} />
          </div>
          <div>
            <Label>{t("certifications.fields.issueDate")} *</Label>
            <Input type="date" value={form.issueDate} onChange={e => setForm(f => ({ ...f, issueDate: e.target.value }))} />
          </div>
          <div>
            <Label>{t("certifications.fields.expiryDate")}</Label>
            <Input type="date" value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} />
          </div>
          <div>
            <Label>{t("certifications.fields.status")}</Label>
            <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{t(`certifications.status.${s}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>{t("certifications.fields.certScope")}</Label>
            <Textarea value={form.certScope} onChange={e => setForm(f => ({ ...f, certScope: e.target.value }))} rows={2} />
          </div>
          {certType === "product" && (
            <div className="col-span-2">
              <Label>{t("certifications.fields.productModels")} * ({t("certifications.import.selectType")})</Label>
              <Textarea
                value={form.productModelsStr}
                onChange={e => setForm(f => ({ ...f, productModelsStr: e.target.value }))}
                placeholder="MODEL-A, MODEL-B, MODEL-C"
                rows={2}
              />
            </div>
          )}
          <div className="col-span-2">
            <Label>{t("certifications.fields.remark")}</Label>
            <Textarea value={form.remark} onChange={e => setForm(f => ({ ...f, remark: e.target.value }))} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? t("common.loading") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
