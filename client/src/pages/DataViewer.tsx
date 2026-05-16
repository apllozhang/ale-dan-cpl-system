import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { trpc } from "@/lib/trpc";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Search,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  X,
  Loader2,
  Database,
  Eye,
  EyeOff,
  Settings2,
  GripVertical,
  Download,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { exportToExcel } from "@/lib/exportUtils";

const COLUMNS = [
  { key: "productGroup", label: "产品组件", defaultWidth: 140 },
  { key: "taxCategory", label: "税务小类", defaultWidth: 110 },
  { key: "productModel", label: "产品型号", defaultWidth: 140 },
  { key: "productDesc", label: "产品说明", defaultWidth: 280 },
  { key: "salesCategory", label: "销售类别", defaultWidth: 90 },
  { key: "serviceCategory", label: "服务类别", defaultWidth: 90 },
  { key: "productStatus", label: "产品状态", defaultWidth: 90 },
  { key: "listPrice", label: "媒体价", defaultWidth: 100 },
  { key: "priceNote", label: "价格说明", defaultWidth: 110 },
  { key: "isNew", label: "新品", defaultWidth: 60 },
  { key: "remark", label: "备注", defaultWidth: 140 },
] as const;

type ColumnKey = (typeof COLUMNS)[number]["key"];

const DEFAULT_VISIBLE_COLUMNS: Set<ColumnKey> = new Set([
  "productModel" as ColumnKey,
  "productDesc" as ColumnKey,
  "listPrice" as ColumnKey,
]);

const STORAGE_KEY_COLUMNS = "ale-cpl-visible-columns";
const STORAGE_KEY_WIDTHS = "ale-cpl-column-widths";

export default function DataViewer() {
  const [location] = useLocation();
  // Parse sheet parameter from URL more reliably
  const getSheetFromUrl = () => {
    const match = location.match(/[?&]sheet=([^&]*)/);
    return match ? decodeURIComponent(match[1]) : '';
  };
  const sheetFromUrl = getSheetFromUrl();
  
  const [activeSheet, setActiveSheet] = useState<string>(() => {
    // Initialize with sheet from URL if available, otherwise empty
    return sheetFromUrl || '';
  });
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sortBy, setSortBy] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selectAll, setSelectAll] = useState(false);

  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_COLUMNS);
      if (stored) {
        const parsed = JSON.parse(stored) as string[];
        const filtered = parsed.filter((col): col is ColumnKey => 
          COLUMNS.some(c => c.key === col)
        );
        if (filtered.length > 0) {
          return new Set(filtered);
        }
      }
    } catch (e) {
      console.error("Failed to load visible columns from storage", e);
    }
    return new Set(Array.from(DEFAULT_VISIBLE_COLUMNS));
  });

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_WIDTHS);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error("Failed to load column widths from storage", e);
    }
    const defaults: Record<string, number> = {};
    COLUMNS.forEach((col) => {
      defaults[col.key] = col.defaultWidth;
    });
    return defaults;
  });

  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);

  // Save visible columns to localStorage
  useEffect(() => {
    try {
      const cols = Array.from(visibleColumns) as string[];
      localStorage.setItem(STORAGE_KEY_COLUMNS, JSON.stringify(cols));
    } catch (e) {
      console.error("Failed to save visible columns to storage", e);
    }
  }, [visibleColumns]);

  // Save column widths to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_WIDTHS, JSON.stringify(columnWidths));
    } catch (e) {
      console.error("Failed to save column widths to storage", e);
    }
  }, [columnWidths]);

  // Handle column resize
  useEffect(() => {
    if (!resizingColumn) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - resizeStartX;
      const newWidth = Math.max(60, resizeStartWidth + delta);
      setColumnWidths((prev) => ({
        ...prev,
        [resizingColumn]: newWidth,
      }));
    };

    const handleMouseUp = () => {
      setResizingColumn(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizingColumn, resizeStartX, resizeStartWidth]);

  const handleResizeStart = (columnKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    setResizingColumn(columnKey);
    setResizeStartX(e.clientX);
    setResizeStartWidth(columnWidths[columnKey] || 100);
  };

  // Handle checkbox selection
  const handleSelectRow = (productId: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedRows(newSelected);
    setSelectAll(newSelected.size === products.length && products.length > 0);
  };

  // Handle select all
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedRows(new Set());
      setSelectAll(false);
    } else {
      const allIds = new Set(products.map((p: any) => p.id.toString()));
      setSelectedRows(allIds);
      setSelectAll(true);
    }
  };

  // Reset selection when page changes
  useEffect(() => {
    setSelectAll(false);
    setSelectedRows(new Set());
  }, [page, debouncedSearch, activeSheet]);

  // Debounce search
  const [searchTimer, setSearchTimer] = useState<NodeJS.Timeout | null>(null);
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (searchTimer) clearTimeout(searchTimer);
    const timer = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 300);
    setSearchTimer(timer);
  }, [searchTimer]);

  const sheetsQuery = trpc.cpl.sheets.useQuery();
  const sheets = sheetsQuery.data ?? [];

  // Update activeSheet when URL parameter changes
  useEffect(() => {
    const newSheet = getSheetFromUrl();
    if (newSheet && newSheet !== activeSheet) {
      setActiveSheet(newSheet);
      setPage(1); // Reset to first page when sheet changes
    }
  }, [location, activeSheet]);

  // Set first sheet as default when loaded
  const currentSheet = activeSheet || (sheets.length > 0 ? sheets[0].sheetName : "");

  const activeFilters = useMemo(() => {
    const active: Record<string, string> = {};
    for (const [k, v] of Object.entries(filters)) {
      if (v && v.trim()) active[k] = v;
    }
    return Object.keys(active).length > 0 ? active : undefined;
  }, [filters]);

  // When searching, don't limit to current sheet - search across all products
  const productsQuery = trpc.cpl.products.useQuery(
    {
      sheetName: debouncedSearch ? undefined : (currentSheet || undefined),
      search: debouncedSearch || undefined,
      page,
      pageSize,
      sortBy,
      sortOrder,
      filters: activeFilters,
    },
    { enabled: !!currentSheet || !!debouncedSearch }
  );

  const products = productsQuery.data?.items ?? [];
  const total = productsQuery.data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
    setPage(1);
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({});
    setPage(1);
  };

  const toggleColumnVisibility = (key: ColumnKey) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev) as Set<ColumnKey>;
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next as Set<ColumnKey>;
    });
  };

  const visibleColumnsList = COLUMNS.filter((c) => visibleColumns.has(c.key));

  const activeFilterCount = Object.values(filters).filter((v) => v && v.trim()).length;

  const getSortIcon = (column: string) => {
    if (sortBy !== column) return <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground/40" />;
    return sortOrder === "asc" ? (
      <ChevronUp className="w-3.5 h-3.5 text-primary" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 text-primary" />
    );
  };

  const getCellValue = (product: any, key: ColumnKey) => {
    return product[key] || "";
  };

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Database className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold text-foreground">产品数据</h1>
          {total > 0 && (
            <Badge variant="secondary" className="font-normal text-xs">
              {total.toLocaleString()} 条记录
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="搜索所有字段..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 w-64 h-9 text-sm bg-background"
            />
            {search && (
              <button
                onClick={() => { setSearch(""); setDebouncedSearch(""); setPage(1); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="h-9 gap-1.5"
          >
            <Filter className="w-3.5 h-3.5" />
            筛选
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs bg-primary-foreground text-primary">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5">
                <Settings2 className="w-3.5 h-3.5" />
                列设置
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="px-2 py-1.5 text-sm font-medium text-foreground">显示/隐藏列</div>
              <DropdownMenuSeparator />
              {COLUMNS.map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.key}
                  checked={visibleColumns.has(col.key)}
                  onCheckedChange={() => toggleColumnVisibility(col.key)}
                  className="cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    {visibleColumns.has(col.key) ? (
                      <Eye className="w-3.5 h-3.5" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5" />
                    )}
                    {col.label}
                  </div>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Batch operation toolbar */}
      {selectedRows.size > 0 && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              已选择 {selectedRows.size} 个产品
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSelectedRows(new Set());
                setSelectAll(false);
              }}
            >
              取消选择
            </Button>
            <Button
              size="sm"
              variant="default"
              onClick={() => {
                const selectedProducts = products.filter(p => selectedRows.has(String(p.id)));
                if (selectedProducts.length === 0) {
                  alert('请先选择产品');
                  return;
                }

                const visibleCols = COLUMNS.filter(col => visibleColumns.has(col.key));
                const exportData = selectedProducts.map(product => {
                  const row: Record<string, any> = {};
                  visibleCols.forEach(col => {
                    row[col.key] = (product as any)[col.key] || '';
                  });
                  return row;
                });

                exportToExcel(
                  exportData,
                  visibleCols.map(col => ({ key: col.key, label: col.label })),
                  `ALE_CPL_${currentSheet}`
                );
              }}
            >
              <Download className="w-4 h-4 mr-1" />
              批量导出 Excel
            </Button>
          </div>
        </div>
      )}

      {/* Sheet tabs */}
      {sheets.length > 0 && (
        <div className="flex gap-1 overflow-x-auto pb-1 -mb-1 scrollbar-thin">
          {sheets.map((sheet) => (
            <button
              key={sheet.sheetName}
              onClick={() => { setActiveSheet(sheet.sheetName); setPage(1); }}
              className={`
                shrink-0 px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap
                ${(currentSheet === sheet.sheetName)
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }
              `}
            >
              {sheet.sheetName}
              <span className="ml-1.5 text-xs opacity-70">({sheet.productCount})</span>
            </button>
          ))}
        </div>
      )}

      {/* Column filters */}
      {showFilters && (
        <div className="bg-card border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">列筛选</span>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs">
                清除所有
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
            {COLUMNS.map((col) => (
              <div key={col.key}>
                <Input
                  placeholder={col.label}
                  value={filters[col.key] || ""}
                  onChange={(e) => handleFilterChange(col.key, e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data table with horizontal scroll and draggable columns */}
      <div className="flex-1 border rounded-lg bg-card overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1" style={{ overflowX: 'auto', overflowY: 'hidden' }}>
          <Table style={{ width: 'max-content', minWidth: '100%' }}>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-12 px-3 py-2 border-r border-border/50">
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={handleSelectAll}
                    className="w-4 h-4 cursor-pointer"
                    title="全选/取消全选"
                  />
                </TableHead>
                {visibleColumnsList.map((col, idx) => (
                  <TableHead
                    key={col.key}
                    className="cursor-pointer select-none text-xs font-semibold text-foreground/80 hover:text-foreground transition-colors border-r border-border/50 last:border-r-0 px-3 py-2 whitespace-nowrap relative group"
                    style={{ width: `${columnWidths[col.key] || col.defaultWidth}px` }}
                    onClick={() => handleSort(col.key)}
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      {getSortIcon(col.key)}
                    </div>
                    {/* Resize handle - available for all columns */}
                    <div
                      onMouseDown={(e) => handleResizeStart(col.key, e)}
                      className="absolute right-0 top-0 bottom-0 w-1 bg-border/0 hover:bg-primary/50 cursor-col-resize transition-colors opacity-0 group-hover:opacity-100"
                      title="拖动调整列宽"
                    />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {productsQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={visibleColumnsList.length} className="h-48 text-center">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">加载中...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={visibleColumnsList.length} className="h-48 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Database className="w-8 h-8 opacity-30" />
                      <span className="text-sm">暂无数据</span>
                      {(debouncedSearch || activeFilterCount > 0) && (
                        <span className="text-xs">尝试调整搜索条件或筛选器</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                products.map((product: any) => (
                  <TableRow 
                    key={product.id} 
                    onClick={() => setSelectedRowId(selectedRowId === product.id ? null : product.id)}
                    className={`group cursor-pointer border-b border-border/50 last:border-b-0 transition-colors ${
                      selectedRowId === product.id 
                        ? 'bg-primary/15 hover:bg-primary/20' 
                        : 'hover:bg-accent/30'
                    }`}
                  >
                    <TableCell className="w-12 px-3 py-3 border-r border-border/50 align-middle">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(product.id.toString())}
                        onChange={() => handleSelectRow(product.id.toString())}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </TableCell>
                    {visibleColumnsList.map((col) => (
                      <TableCell
                        key={col.key}
                        className="text-xs py-3 px-3 border-r border-border/50 last:border-r-0 align-top"
                        style={{ width: `${columnWidths[col.key] || col.defaultWidth}px` }}
                      >
                        <div className="break-words whitespace-normal">
                          {col.key === "isNew" && getCellValue(product, col.key) ? (
                            <Badge variant="default" className="text-[10px] h-5 px-1.5 bg-emerald-500/10 text-emerald-600 border-emerald-200">
                              {getCellValue(product, col.key)}
                            </Badge>
                          ) : col.key === "productStatus" && getCellValue(product, col.key) ? (
                            <Badge
                              variant="outline"
                              className={`text-[10px] h-5 px-1.5 ${
                                getCellValue(product, col.key).includes("GA")
                                  ? "border-emerald-200 text-emerald-600"
                                  : getCellValue(product, col.key).includes("EOS") || getCellValue(product, col.key).includes("EOL")
                                  ? "border-red-200 text-red-500"
                                  : "border-amber-200 text-amber-600"
                              }`}
                            >
                              {getCellValue(product, col.key)}
                            </Badge>
                          ) : col.key === "listPrice" ? (
                            <span className="font-medium tabular-nums">
                              {getCellValue(product, col.key) ? `¥${Number(getCellValue(product, col.key)).toLocaleString()}` : ""}
                            </span>
                          ) : (
                            <span>{getCellValue(product, col.key)}</span>
                          )}
                        </div>
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 0 && (
        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>每页</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}
            >
              <SelectTrigger className="h-8 w-[70px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="200">200</SelectItem>
              </SelectContent>
            </Select>
            <span>条</span>
            <span className="ml-2 text-xs">
              第 {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} 条，共 {total.toLocaleString()} 条
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={page <= 1}
              onClick={() => setPage(1)}
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <div className="flex items-center gap-1 mx-1">
              {generatePageNumbers(page, totalPages).map((p, i) =>
                p === "..." ? (
                  <span key={`ellipsis-${i}`} className="px-1 text-xs text-muted-foreground">...</span>
                ) : (
                  <Button
                    key={p}
                    variant={page === p ? "default" : "outline"}
                    size="sm"
                    className="h-8 w-8 p-0 text-xs"
                    onClick={() => setPage(p as number)}
                  >
                    {p}
                  </Button>
                )
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={page >= totalPages}
              onClick={() => setPage(totalPages)}
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function generatePageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [];
  if (current <= 4) {
    for (let i = 1; i <= 5; i++) pages.push(i);
    pages.push("...", total);
  } else if (current >= total - 3) {
    pages.push(1, "...");
    for (let i = total - 4; i <= total; i++) pages.push(i);
  } else {
    pages.push(1, "...", current - 1, current, current + 1, "...", total);
  }
  return pages;
}
