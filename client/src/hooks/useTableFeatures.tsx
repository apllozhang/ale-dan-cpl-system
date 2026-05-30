import { useState, useEffect, useCallback } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

export interface ColumnDef {
  key: string;
  label: string;
  defaultWidth: number;
  sortable?: boolean;
}

export function useTableFeatures(columns: ColumnDef[]) {
  const [sortBy, setSortBy] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const defaults: Record<string, number> = {};
    columns.forEach(c => { defaults[c.key] = c.defaultWidth; });
    return defaults;
  });
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);

  useEffect(() => {
    if (!resizingColumn) return;
    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - resizeStartX;
      setColumnWidths(prev => ({ ...prev, [resizingColumn]: Math.max(50, resizeStartWidth + delta) }));
    };
    const handleMouseUp = () => setResizingColumn(null);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => { document.removeEventListener("mousemove", handleMouseMove); document.removeEventListener("mouseup", handleMouseUp); };
  }, [resizingColumn, resizeStartX, resizeStartWidth]);

  const handleResizeStart = useCallback((colKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    setResizingColumn(colKey);
    setResizeStartX(e.clientX);
    setResizeStartWidth(columnWidths[colKey] || 100);
  }, [columnWidths]);

  const handleSort = useCallback((column: string) => {
    if (sortBy === column) {
      setSortOrder(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  }, [sortBy]);

  const getSortIcon = useCallback((column: string) => {
    if (sortBy !== column) return <ChevronsUpDown className="w-3 h-3 text-muted-foreground/40" />;
    return sortOrder === "asc"
      ? <ChevronUp className="w-3 h-3 text-primary" />
      : <ChevronDown className="w-3 h-3 text-primary" />;
  }, [sortBy, sortOrder]);

  const sortData = useCallback(<T extends Record<string, any>>(data: T[]): T[] => {
    if (!sortBy) return data;
    return [...data].sort((a, b) => {
      const va = a[sortBy] ?? "";
      const vb = b[sortBy] ?? "";
      const cmp = typeof va === "number" && typeof vb === "number"
        ? va - vb
        : String(va).localeCompare(String(vb));
      return sortOrder === "asc" ? cmp : -cmp;
    });
  }, [sortBy, sortOrder]);

  const renderHeader = useCallback((col: ColumnDef, isLast: boolean) => (
    <th
      key={col.key}
      className={`px-3 py-2 text-xs font-semibold text-left border-r border-border/50 relative group select-none ${
        col.sortable ? "cursor-pointer hover:text-foreground" : ""
      } ${isLast ? "last:border-r-0" : ""}`}
      style={{ width: `${columnWidths[col.key] || col.defaultWidth}px` }}
      onClick={() => col.sortable && handleSort(col.key)}
    >
      <div className="flex items-center gap-1">
        {col.label}
        {col.sortable && getSortIcon(col.key)}
      </div>
      <div
        onMouseDown={e => handleResizeStart(col.key, e)}
        className="absolute right-0 top-0 bottom-0 w-1.5 bg-border/0 hover:bg-primary/50 cursor-col-resize transition-colors opacity-0 group-hover:opacity-100"
      />
    </th>
  ), [columnWidths, handleSort, getSortIcon, handleResizeStart]);

  const renderCell = useCallback((col: ColumnDef, isLast: boolean, content: React.ReactNode) => (
    <td
      key={col.key}
      className={`px-3 py-2 text-xs border-r border-border/50 last:border-r-0`}
      style={{ width: `${columnWidths[col.key] || col.defaultWidth}px` }}
    >
      <div className="break-words whitespace-normal">{content}</div>
    </td>
  ), [columnWidths]);

  return {
    sortBy, sortOrder, handleSort, getSortIcon, sortData,
    columnWidths, handleResizeStart, renderHeader, renderCell,
  };
}
