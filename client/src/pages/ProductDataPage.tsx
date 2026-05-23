import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Filter,
  X,
  Loader2,
  Database,
  Eye,
  EyeOff,
  Settings2,
  Download,
  FileSpreadsheet,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import {
  getAllCategories,
  buildCategoryNav,
  getSheetsByCategory,
  getSheetsBySubcategory,
  getModelFilter,
  type ProductCategory,
  type CategoryNavItem,
} from "@/lib/productCategories";
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
const STORAGE_KEY_CATEGORY = "ale-cpl-selected-category";
const STORAGE_KEY_SIDEBAR_COLLAPSED = "ale-cpl-sidebar-collapsed";

export default function ProductDataPage() {
  const [location, setLocation] = useLocation();
  const sheetsQuery = trpc.cpl.sheets.useQuery();
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_SIDEBAR_COLLAPSED);
      return stored === "true";
    } catch {
      return false;
    }
  });
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_CATEGORY);
      return stored || "wired-network";
    } catch {
      return "wired-network";
    }
  });
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(["wired-network"])
  );
  const [selectedSheet, setSelectedSheet] = useState<string>("");
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
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
      console.error("Failed to load visible columns", e);
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
      console.error("Failed to load column widths", e);
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

  // Save selected category
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CATEGORY, selectedCategoryId);
    } catch (e) {
      console.error("Failed to save selected category", e);
    }
  }, [selectedCategoryId]);

  // Save visible columns
  useEffect(() => {
    try {
      const cols = Array.from(visibleColumns) as string[];
      localStorage.setItem(STORAGE_KEY_COLUMNS, JSON.stringify(cols));
    } catch (e) {
      console.error("Failed to save visible columns", e);
    }
  }, [visibleColumns]);

  // Save column widths
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_WIDTHS, JSON.stringify(columnWidths));
    } catch (e) {
      console.error("Failed to save column widths", e);
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

  // Build category navigation
  const categoryNav = useMemo(() => {
    if (!sheetsQuery.data) return [];
    return buildCategoryNav(
      sheetsQuery.data.map(s => ({
        sheetName: s.sheetName,
        productCount: s.productCount,
      }))
    );
  }, [sheetsQuery.data]);

  // Get sheets for selected category (filtered by subcategory if selected)
  const categorySheets = useMemo(() => {
    if (!sheetsQuery.data) return [];
    const sheets = sheetsQuery.data.map(s => ({
      sheetName: s.sheetName,
      productCount: s.productCount,
    }));
    if (selectedSubcategoryId) {
      return getSheetsBySubcategory(sheets, selectedCategoryId, selectedSubcategoryId);
    }
    return getSheetsByCategory(sheets, selectedCategoryId);
  }, [sheetsQuery.data, selectedCategoryId, selectedSubcategoryId]);

  // Set default sheet when subcategory changes OR when category changes (for categories without subcategories)
  useEffect(() => {
    if (categorySheets.length > 0) {
      // Find the selected category from the nav
      const selectedCat = categoryNav.find(
        item => item.type === 'category' && item.category.id === selectedCategoryId
      )?.category;
      
      // Check if category has subcategories
      const hasSubcategories = selectedCat?.subcategories && selectedCat.subcategories.length > 0;
      
      // Auto-select sheet if:
      // 1. A subcategory is selected, OR
      // 2. The category has no subcategories (like wireless, nms, etc.)
      if (selectedSubcategoryId || !hasSubcategories) {
        setSelectedSheet(categorySheets[0].sheetName);
        setPage(1);
      }
    }
  }, [selectedSubcategoryId, categorySheets, selectedCategoryId]);

  // Fetch products for selected sheet
  const productsQuery = trpc.cpl.products.useQuery(
    {
      sheetName: selectedSheet || undefined,
      search: debouncedSearch,
      page,
      pageSize,
      sortBy,
      sortOrder,
      filters: Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v && v.trim())
      ),
    },
    { enabled: !!selectedSheet }
  );

  const products = productsQuery.data?.items || [];
  const total = productsQuery.data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleSelectRow = (productId: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedRows(newSelected);
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedRows(new Set());
      setSelectAll(false);
    } else {
      const allIds = products.map(p => String(p.id));
      setSelectedRows(new Set(allIds));
      setSelectAll(true);
    }
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
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

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setSelectedSubcategoryId("");
    // Sheet will be auto-selected by useEffect based on whether category has subcategories
  };

  const handleSubcategorySelect = (subcategoryId: string) => {
    setSelectedSubcategoryId(subcategoryId);
    // Sheet will be auto-selected by useEffect
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const handleToggleSidebar = () => {
    const newState = !sidebarCollapsed;
    setSidebarCollapsed(newState);
    localStorage.setItem(STORAGE_KEY_SIDEBAR_COLLAPSED, String(newState));
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
    <div className="h-full flex flex-col">
      {/* Header with sidebar toggle */}
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-white">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggleSidebar}
          className="-ml-2"
          title={sidebarCollapsed ? "展开分类" : "收缩分类"}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <ChevronLeft className="h-5 w-5" />
          )}
        </Button>
      </div>
      
      {/* Main content area */}
      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* Sidebar - Category Navigation */}
        <div
          className={`${
            sidebarCollapsed ? "w-0" : "w-64"
          } transition-all duration-300 overflow-hidden flex flex-col border-r bg-slate-50`}
        >
        <div className="p-4 border-b">
          <h2 className="text-sm font-semibold text-foreground">产品分类</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {getAllCategories().map((category) => {
            const categoryItems = categoryNav.filter(
              (item) => item.category.id === category.id
            );
            if (categoryItems.length === 0) return null;

            const isExpanded = expandedCategories.has(category.id);
            const isSelected = selectedCategoryId === category.id;
            const totalCount = categoryItems[0]?.totalCount || 0;

            return (
              <div key={category.id} className="border-b">
                {/* Main category button */}
                <button
                  onClick={() => {
                    handleCategorySelect(category.id);
                    if (categoryItems.some(item => item.type === "subcategory")) {
                      toggleCategory(category.id);
                    }
                  }}
                  className={`w-full px-4 py-2.5 text-left text-sm font-medium transition-colors flex items-center justify-between ${
                    isSelected
                      ? "bg-primary/10 text-primary border-l-2 border-primary"
                      : "text-foreground hover:bg-accent"
                  }`}
                >
                  <div className="flex items-center gap-2 flex-1">
                    <span>{category.icon}</span>
                    <span className="flex-1">{category.label}</span>
                    <Badge variant="secondary" className="text-xs">
                      {totalCount}
                    </Badge>
                  </div>
                  {categoryItems.some(item => item.type === "subcategory") && (
                    <ChevronRight
                      className={`w-4 h-4 transition-transform ${
                        isExpanded ? "rotate-90" : ""
                      }`}
                    />
                  )}
                </button>

                {/* Subcategories */}
                {isExpanded &&
                  categoryItems
                    .filter((item) => item.type === "subcategory")
                    .map((item) => {
                      const isSubSelected = selectedSubcategoryId === item.subcategory?.id;
                      return (
                        <button
                          key={item.subcategory?.id}
                          onClick={() => {
                            const subId = item.subcategory?.id || "";
                            setSelectedCategoryId(category.id);
                            setSelectedSubcategoryId(subId);
                            setPage(1);
                            // Directly find matching sheets for this subcategory
                            if (sheetsQuery.data) {
                              const sheets = sheetsQuery.data.map(s => ({ sheetName: s.sheetName, productCount: s.productCount }));
                              const matching = getSheetsBySubcategory(sheets, category.id, subId);
                              setSelectedSheet(matching[0]?.sheetName || "");
                            } else {
                              setSelectedSheet("");
                            }
                          }}
                          className={`w-full px-8 py-2 text-left text-xs transition-colors ${
                            isSubSelected
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-muted-foreground hover:text-foreground hover:bg-accent"
                          }`}
                        >
                          {item.subcategory?.label}
                        </button>
                      );
                    })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col gap-4 overflow-hidden px-6 py-4">
        {/* Header */}
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
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-64 h-9 text-sm bg-background"
              />
              {search && (
                <button
                  onClick={() => {
                    setSearch("");
                    setDebouncedSearch("");
                    setPage(1);
                  }}
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

        {/* Sheet tabs - only show when subcategory selected */}
        {selectedSubcategoryId && categorySheets.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2 border-b">
            {categorySheets.map((sheet) => (
              <button
                key={sheet.sheetName}
                onClick={() => {
                  setSelectedSheet(sheet.sheetName);
                  setPage(1);
                }}
                className={`
                  shrink-0 px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap
                  ${selectedSheet === sheet.sheetName
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
                variant="default"
                onClick={() => {
                  const selectedProductIds = Array.from(selectedRows).join(",");
                  setLocation(`/quotations/new?productIds=${selectedProductIds}`);
                }}
              >
                <FileSpreadsheet className="w-4 h-4 mr-1" />
                创建报价
              </Button>
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
                  const selectedProducts = products.filter((p: any) => selectedRows.has(String(p.id)));
                  if (selectedProducts.length === 0) {
                    alert('请先选择产品');
                    return;
                  }

                  const visibleCols = COLUMNS.filter(col => visibleColumns.has(col.key));
                  const exportData = selectedProducts.map((product: any) => {
                    const row: Record<string, any> = {};
                    visibleCols.forEach(col => {
                      row[col.key] = (product as any)[col.key] || '';
                    });
                    return row;
                  });

                  const fileName = `产品数据_${new Date().toISOString().split('T')[0]}.xlsx`;
                  const exportColumns = visibleCols.map(c => ({ key: c.key, label: c.label }));
                  exportToExcel(exportData, exportColumns, fileName);
                }}
              >
                <Download className="w-4 h-4 mr-1" />
                导出
              </Button>
            </div>
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

        {/* Data table */}
        <div className="flex-1 border rounded-lg bg-card overflow-hidden flex flex-col">
          <div className="overflow-x-auto flex-1">
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
                  {visibleColumnsList.map((col) => (
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
                {!selectedSheet ? (
                  <TableRow>
                    <TableCell colSpan={visibleColumnsList.length + 1} className="h-48 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Database className="w-8 h-8 opacity-20" />
                        <span className="text-sm">请选择左侧子分类查看产品数据</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : productsQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={visibleColumnsList.length + 1} className="h-48 text-center">
                      <div className="flex items-center justify-center gap-2 text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">加载中...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={visibleColumnsList.length + 1} className="h-48 text-center">
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
                        {col.key === "isNew" && getCellValue(product as any, col.key) ? (
                              <Badge variant="default" className="text-[10px] h-5 px-1.5 bg-emerald-500/10 text-emerald-600 border-emerald-200">
                                {getCellValue(product as any, col.key)}
                              </Badge>
                            ) : (
                              getCellValue(product as any, col.key)
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
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              第 {page} / {totalPages} 页，共 {total} 条记录
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(1)}
                disabled={page === 1}
              >
                首页
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
              >
                上一页
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
              >
                下一页
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
              >
                末页
              </Button>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
