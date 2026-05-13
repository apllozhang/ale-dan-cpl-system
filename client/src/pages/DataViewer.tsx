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
import { useState, useMemo, useCallback } from "react";
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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const COLUMNS = [
  { key: "productGroup", label: "产品组件", width: "140px" },
  { key: "taxCategory", label: "税务小类", width: "110px" },
  { key: "productModel", label: "产品型号", width: "140px" },
  { key: "productDesc", label: "产品说明", width: "280px" },
  { key: "salesCategory", label: "销售类别", width: "90px" },
  { key: "serviceCategory", label: "服务类别", width: "90px" },
  { key: "productStatus", label: "产品状态", width: "90px" },
  { key: "listPrice", label: "媒体价", width: "100px" },
  { key: "priceNote", label: "价格说明", width: "110px" },
  { key: "isNew", label: "新品", width: "60px" },
  { key: "remark", label: "备注", width: "140px" },
] as const;

type ColumnKey = (typeof COLUMNS)[number]["key"];

export default function DataViewer() {
  const [activeSheet, setActiveSheet] = useState<string>("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sortBy, setSortBy] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(
    new Set(COLUMNS.map((c) => c.key))
  );

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

  // Set first sheet as default when loaded
  const currentSheet = activeSheet || (sheets.length > 0 ? sheets[0].sheetName : "");

  const activeFilters = useMemo(() => {
    const active: Record<string, string> = {};
    for (const [k, v] of Object.entries(filters)) {
      if (v && v.trim()) active[k] = v;
    }
    return Object.keys(active).length > 0 ? active : undefined;
  }, [filters]);

  const productsQuery = trpc.cpl.products.useQuery(
    {
      sheetName: currentSheet || undefined,
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
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
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

  const getCellValue = (product: any, key: string) => {
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

      {/* Data table with horizontal scroll */}
      <div className="flex-1 border rounded-lg bg-card overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                {visibleColumnsList.map((col) => (
                  <TableHead
                    key={col.key}
                    className="cursor-pointer select-none text-xs font-semibold text-foreground/80 hover:text-foreground transition-colors border-r border-border/50 last:border-r-0 px-3 py-2 whitespace-nowrap"
                    style={{ minWidth: col.width }}
                    onClick={() => handleSort(col.key)}
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      {getSortIcon(col.key)}
                    </div>
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
                  <TableRow key={product.id} className="group hover:bg-accent/30 transition-colors border-b border-border/50 last:border-b-0">
                    {visibleColumnsList.map((col) => (
                      <TableCell
                        key={col.key}
                        className="text-xs py-3 px-3 border-r border-border/50 last:border-r-0 align-top"
                        style={{ minWidth: col.width }}
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
