/**
 * Shared file save utility with File System Access API support.
 * Uses showSaveFilePicker when available (lets user choose path),
 * falls back to automatic download.
 */

type SaveFilePickerOptions = {
  suggestedName?: string;
  types?: Array<{
    description?: string;
    accept: Record<string, string[]>;
  }>;
};

type FileSystemFileHandle = {
  createWritable(): Promise<FileSystemWritableFileStream>;
};

type FileSystemWritableFileStream = WritableStream & {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
};

type ShowSaveFilePickerFn = (opts?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;

function getPicker(): ShowSaveFilePickerFn | null {
  if (typeof window !== "undefined" && "showSaveFilePicker" in window) {
    return (window as unknown as { showSaveFilePicker: ShowSaveFilePickerFn }).showSaveFilePicker;
  }
  return null;
}

export async function saveBlobWithPicker(blob: Blob, defaultFilename: string, mimeType: string): Promise<void> {
  const picker = getPicker();
  if (picker) {
    try {
      const ext = defaultFilename.split(".").pop() || "";
      const handle = await picker({
        suggestedName: defaultFilename,
        types: [{
          description: ext.toUpperCase(),
          accept: { [mimeType]: [`.${ext}`] },
        }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = defaultFilename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function saveArrayBufferWithPicker(buffer: ArrayBuffer, defaultFilename: string, mimeType: string): Promise<void> {
  const blob = new Blob([buffer], { type: mimeType });
  await saveBlobWithPicker(blob, defaultFilename, mimeType);
}

export async function saveStringWithPicker(content: string, defaultFilename: string, mimeType: string): Promise<void> {
  const blob = new Blob([content], { type: mimeType });
  await saveBlobWithPicker(blob, defaultFilename, mimeType);
}
