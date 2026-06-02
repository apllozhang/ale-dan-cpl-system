import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Upload, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

export function CertificationImportDialog({ open, onClose, onImported }: Props) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [certType, setCertType] = useState<"product" | "enterprise">("product");
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null);

  const importMut = trpc.certifications.import.useMutation({
    onSuccess: (data) => {
      setResult(data);
      onImported();
      toast.success(`${t("certifications.import.success")}: ${data.imported} ${t("certifications.import.items")}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const handleImport = () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      importMut.mutate({ fileBase64: base64, certType });
    };
    reader.readAsDataURL(file);
  };

  const handleClose = () => {
    setResult(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("certifications.import.title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>{t("certifications.import.selectType")}</Label>
            <Select value={certType} onValueChange={(v: "product" | "enterprise") => setCertType(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="product">{t("certifications.tabs.product")}</SelectItem>
                <SelectItem value="enterprise">{t("certifications.tabs.enterprise")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("certifications.import.uploadExcel")}</Label>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="mt-1 block w-full text-sm" />
          </div>
          {result && (
            <div className="rounded-md bg-muted p-3 text-sm space-y-1">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                {t("certifications.import.success")}: {result.imported}
              </div>
              {result.errors.length > 0 && (
                <div className="flex items-start gap-2">
                  <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
                  <div>
                    {t("certifications.import.failed")}: {result.errors.length}
                    <ul className="list-disc ml-4 mt-1">
                      {result.errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
                      {result.errors.length > 10 && <li>...</li>}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>{t("common.cancel")}</Button>
          <Button onClick={handleImport} disabled={importMut.isPending}>
            <Upload className="h-4 w-4 mr-2" />
            {importMut.isPending ? t("common.loading") : t("certifications.actions.import")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
