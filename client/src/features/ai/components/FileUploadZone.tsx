import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Upload, X, FileText, ImageIcon } from "lucide-react";
import { useRef } from "react";

export type UploadedFile = {
  name: string;
  size: number;
  type: string;
  extractedText?: string;
  preview?: string;
};

type Props = {
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
};

const ALLOWED_EXTENSIONS = ["pdf", "docx", "doc", "xlsx", "xls", "txt", "csv", "png", "jpg", "jpeg", "gif", "webp"];
const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp"];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

export function FileUploadZone({ files, onFilesChange }: Props) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    const newFiles: UploadedFile[] = [];
    let pendingReaders = 0;
    const totalFiles = selectedFiles.length;

    for (let i = 0; i < totalFiles; i++) {
      const file = selectedFiles[i];
      const ext = getFileExtension(file.name);

      if (!ALLOWED_EXTENSIONS.includes(ext)) continue;
      if (file.size > MAX_FILE_SIZE) continue;

      const isImage = IMAGE_EXTENSIONS.includes(ext);
      const entry: UploadedFile = {
        name: file.name,
        size: file.size,
        type: ext,
        preview: undefined,
      };

      if (isImage) {
        pendingReaders++;
        const reader = new FileReader();
        reader.onload = () => {
          entry.preview = reader.result as string;
          pendingReaders--;
          if (pendingReaders === 0) {
            onFilesChange([...files, ...newFiles]);
          }
        };
        reader.readAsDataURL(file);
      }

      newFiles.push(entry);
    }

    if (pendingReaders === 0 && newFiles.length > 0) {
      onFilesChange([...files, ...newFiles]);
    }

    // Reset input so the same file can be re-selected
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleRemove = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(",")}
        multiple
        onChange={handleChange}
      />
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="size-3.5" />
        {t("ai.uploadFiles")}
      </Button>

      {files.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-xs"
            >
              {IMAGE_EXTENSIONS.includes(file.type) && file.preview ? (
                <img src={file.preview} className="size-5 object-cover rounded shrink-0" alt={file.name} />
              ) : IMAGE_EXTENSIONS.includes(file.type) ? (
                <ImageIcon className="size-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <FileText className="size-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className="flex-1 truncate">{file.name}</span>
              <span className="shrink-0 text-muted-foreground">
                {formatFileSize(file.size)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-5 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => handleRemove(index)}
              >
                <X className="size-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
