import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, HardDriveUpload } from "lucide-react";
import { toast } from "sonner";

export default function Import() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [importResult, setImportResult] = useState<{
    sheetsImported: number;
    productsImported: number;
    hasSummary: boolean;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const importMutation = trpc.cpl.import.useMutation({
    onSuccess: (data) => {
      setImportResult(data);
      setFile(null);
      toast.success("数据导入成功");
      // Invalidate all CPL queries
      utils.cpl.sheets.invalidate();
      utils.cpl.products.invalidate();
      utils.cpl.summary.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "导入失败，请重试");
    },
  });

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.name.endsWith(".xlsx") && !selectedFile.name.endsWith(".xls")) {
      toast.error("请选择 .xlsx 或 .xls 格式的文件");
      return;
    }
    setFile(selectedFile);
    setImportResult(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  };

  const handleImport = async () => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      importMutation.mutate({
        fileBase64: base64,
        fileName: file.name,
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <HardDriveUpload className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold text-foreground">数据导入</h1>
      </div>

      {/* Info card */}
      <div className="bg-card border rounded-lg p-5 space-y-3">
        <h3 className="text-sm font-medium text-foreground">导入说明</h3>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">·</span>
            支持 .xlsx 格式的 CPL 数据文件
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">·</span>
            导入将替换现有的所有 CPL 数据
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">·</span>
            文件应包含标准 CPL 产品 Sheet 和 Summary Sheet
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">·</span>
            导入过程可能需要几秒钟，请耐心等待
          </li>
        </ul>
      </div>

      {/* Drop zone */}
      <div
        className={`
          border-2 border-dashed rounded-lg p-10 text-center transition-all
          ${isDragging
            ? "border-primary bg-primary/5"
            : file
            ? "border-emerald-300 bg-emerald-50/50"
            : "border-border hover:border-primary/40 hover:bg-accent/30"
          }
        `}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFileSelect(f);
          }}
        />
        {file ? (
          <div className="flex flex-col items-center gap-3">
            <FileSpreadsheet className="w-10 h-10 text-emerald-500" />
            <div>
              <p className="text-sm font-medium text-foreground">{file.name}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {(file.size / 1024).toFixed(1)} KB · 点击更换文件
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Upload className="w-10 h-10 text-muted-foreground/40" />
            <div>
              <p className="text-sm font-medium text-foreground">
                拖拽文件到此处，或点击选择
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                支持 .xlsx 格式
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Import button */}
      {file && (
        <Button
          onClick={handleImport}
          disabled={importMutation.isPending}
          className="w-full h-11 gap-2 shadow-sm"
        >
          {importMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              导入中...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              开始导入
            </>
          )}
        </Button>
      )}

      {/* Result */}
      {importResult && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-medium text-emerald-800">导入成功</p>
              <div className="text-sm text-emerald-700 space-y-1">
                <p>· 导入产品系列: {importResult.sheetsImported} 个</p>
                <p>· 导入产品数据: {importResult.productsImported} 条</p>
                <p>· 变更记录: {importResult.hasSummary ? "已更新" : "无"}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {importMutation.isError && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive">导入失败</p>
              <p className="text-sm text-destructive/80 mt-1">
                {importMutation.error?.message || "请检查文件格式后重试"}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
