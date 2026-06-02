import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, CheckCircle, XCircle, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const DEFAULT_SHEET_NAMES = ["China", "NET Global", "COMM Global"];

interface EFlashImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

interface ImportError {
  row: number;
  reason: string;
}

interface ImportResult {
  created: number;
  updated: number;
  failed: number;
  errors: ImportError[];
}

export function EFlashImportDialog({ open, onClose, onImported }: EFlashImportDialogProps) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheets, setSelectedSheets] = useState<Set<string>>(new Set());
  const [isDragOver, setIsDragOver] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const importMut = trpc.eflash.importExcel.useMutation({
    onSuccess: (data: ImportResult) => {
      setResult(data);
      onImported();
      toast.success(
        `${t("eflash.import.success")}: ${data.created} ${t("eflash.import.created")}, ${data.updated} ${t("eflash.import.updated")}`,
      );
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const resetState = () => {
    setSelectedFile(null);
    setSheetNames([]);
    setSelectedSheets(new Set());
    setResult(null);
    setIsDragOver(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const readSheetNames = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const names = wb.SheetNames;
        setSheetNames(names);
        const defaultSelected = new Set(
          names.filter((n) => DEFAULT_SHEET_NAMES.includes(n)),
        );
        if (defaultSelected.size === 0 && names.length > 0) {
          names.forEach((n) => defaultSelected.add(n));
        }
        setSelectedSheets(defaultSelected);
      } catch {
        toast.error(t("eflash.import.readError"));
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileSelect = (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      toast.error(t("eflash.import.fileTooLarge"));
      return;
    }
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast.error(t("eflash.import.invalidFormat"));
      return;
    }
    setSelectedFile(file);
    setResult(null);
    readSheetNames(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleFileInput = () => {
    const file = fileRef.current?.files?.[0];
    if (file) handleFileSelect(file);
  };

  const toggleSheet = (name: string) => {
    setSelectedSheets((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const handleImport = () => {
    if (!selectedFile) return;
    if (selectedSheets.size === 0) {
      toast.error(t("eflash.import.noSheetSelected"));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      importMut.mutate({
        fileBase64: base64,
        sheetNames: Array.from(selectedSheets),
      });
    };
    reader.onerror = () => {
      toast.error(t("eflash.import.readError"));
    };
    reader.readAsDataURL(selectedFile);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("eflash.import.title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
              isDragOver
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-muted-foreground/50"
            }`}
            onClick={() => fileRef.current?.click()}
          >
            <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {selectedFile
                ? selectedFile.name
                : t("eflash.import.dropzone")}
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {t("eflash.import.fileHint")}
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileInput}
            />
          </div>

          {/* Sheet selection */}
          {sheetNames.length > 0 && (
            <div>
              <Label className="mb-2 block">{t("eflash.import.selectSheets")}</Label>
              <div className="space-y-2 max-h-40 overflow-y-auto rounded-md border p-2">
                {sheetNames.map((name) => (
                  <label key={name} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={selectedSheets.has(name)}
                      onCheckedChange={() => toggleSheet(name)}
                    />
                    <span>{name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="rounded-md bg-muted p-3 text-sm space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>
                  {t("eflash.import.created")}: {result.created} &middot;{" "}
                  {t("eflash.import.updated")}: {result.updated}
                </span>
              </div>
              {result.failed > 0 && (
                <div className="flex items-start gap-2">
                  <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
                  <div>
                    <span>{t("eflash.import.failed")}: {result.failed}</span>
                    {result.errors.length > 0 && (
                      <ul className="list-disc ml-4 mt-1">
                        {result.errors.slice(0, 10).map((e, i) => (
                          <li key={i}>Row {e.row}: {e.reason}</li>
                        ))}
                        {result.errors.length > 10 && <li>...</li>}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleImport}
            disabled={importMut.isPending || !selectedFile || selectedSheets.size === 0}
          >
            <Upload className="h-4 w-4 mr-2" />
            {importMut.isPending ? t("common.loading") : t("eflash.actions.import")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
