import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search, X, Loader2, ChevronRight, Network, Wifi, Monitor, ShieldCheck, Cable, Package,
} from "lucide-react";
import {
  buildCategoryNav, getModelFilter, getQuerySheetName,
  type CategoryNavItem,
} from "@/lib/productCategories";

const CATEGORY_ICONS: Record<string, any> = {
  "wired-network": Network,
  "wireless-network": Wifi,
  "nms-system": Monitor,
  "security-system": ShieldCheck,
  "pol-system": Cable,
  "other-products": Package,
  "services": Network,
  "accessories": Package,
};

interface ProductSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddProducts: (products: Array<{ product: any; quantity: number }>) => void;
  discountRate: number;
  existingProductIds: Set<number>;
}

export default function ProductSelectorDialog({
  open, onOpenChange, onAddProducts, discountRate, existingProductIds,
}: ProductSelectorDialogProps) {
  const [activeNav, setActiveNav] = useState<CategoryNavItem | null>(null);
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedMap, setSelectedMap] = useState<Map<number, { product: any; quantity: number }>>(new Map());
  const [wiredExpanded, setWiredExpanded] = useState(true);
  const [searchTimer, setSearchTimer] = useState<NodeJS.Timeout | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setActiveNav(null);
      setSearchText("");
      setDebouncedSearch("");
      setSelectedMap(new Map());
      setWiredExpanded(true);
    }
  }, [open]);

  // Fetch sheets
  const sheetsQuery = trpc.cpl.sheets.useQuery(undefined, { enabled: open });

  // Build navigation from sheet data
  const navItems = useMemo(() => {
    if (!sheetsQuery.data) return [];
    return buildCategoryNav(sheetsQuery.data);
  }, [sheetsQuery.data]);

  // Auto-select first nav item
  useEffect(() => {
    if (navItems.length > 0 && !activeNav) {
      const firstCategory = navItems.find(n => n.type === "category");
      if (firstCategory) setActiveNav(firstCategory);
    }
  }, [navItems, activeNav]);

  // Fetch products for active nav item
  const sheetName = activeNav ? getQuerySheetName(activeNav) : undefined;
  const productsQuery = trpc.cpl.products.useQuery(
    { sheetName, search: debouncedSearch || undefined, pageSize: 200 },
    { enabled: open && !!activeNav }
  );

  // Client-side model filter for subcategories
  const modelPatterns = activeNav ? getModelFilter(activeNav) : undefined;

  const filteredProducts = useMemo(() => {
    let result = productsQuery.data?.items ?? [];
    if (modelPatterns) {
      result = result.filter(p =>
        modelPatterns.some(pat => pat.test(p.productModel || ""))
      );
    }
    return result;
  }, [productsQuery.data?.items, modelPatterns]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchText(value);
    if (searchTimer) clearTimeout(searchTimer);
    const timer = setTimeout(() => setDebouncedSearch(value), 300);
    setSearchTimer(timer);
  }, [searchTimer]);

  const toggleProduct = useCallback((product: any) => {
    setSelectedMap(prev => {
      const next = new Map(prev);
      if (next.has(product.id)) {
        next.delete(product.id);
      } else {
        next.set(product.id, { product, quantity: 1 });
      }
      return next;
    });
  }, []);

  const updateQuantity = useCallback((productId: number, qty: number) => {
    setSelectedMap(prev => {
      const next = new Map(prev);
      const entry = next.get(productId);
      if (entry) {
        next.set(productId, { ...entry, quantity: Math.max(1, qty) });
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedMap(prev => {
      const next = new Map(prev);
      const allSelected = filteredProducts.every(p => next.has(p.id));
      for (const p of filteredProducts) {
        if (allSelected) {
          next.delete(p.id);
        } else if (!next.has(p.id)) {
          next.set(p.id, { product: p, quantity: 1 });
        }
      }
      return next;
    });
  }, [filteredProducts]);

  const handleAddProducts = () => {
    const products: Array<{ product: any; quantity: number }> = [];
    selectedMap.forEach(({ product, quantity }) => {
      if (!existingProductIds.has(product.id)) {
        products.push({ product, quantity });
      }
    });
    onAddProducts(products);
    onOpenChange(false);
  };

  // Group navItems for rendering
  const categoryNavGroups = useMemo(() => {
    const groups: Array<{ category: CategoryNavItem; subcategories: CategoryNavItem[] }> = [];
    let i = 0;
    while (i < navItems.length) {
      const item = navItems[i];
      if (item.type === "category") {
        const subs: CategoryNavItem[] = [];
        let j = i + 1;
        while (j < navItems.length && navItems[j].type === "subcategory") {
          subs.push(navItems[j]);
          j++;
        }
        groups.push({ category: item, subcategories: subs });
        i = j;
      } else {
        i++;
      }
    }
    return groups;
  }, [navItems]);

  const isNavActive = (nav: CategoryNavItem) => {
    if (!activeNav) return false;
    if (nav.type === "category" && activeNav.type === "category") {
      return nav.category.id === activeNav.category.id;
    }
    if (nav.type === "subcategory" && activeNav.type === "subcategory") {
      return nav.subcategory.id === activeNav.subcategory.id;
    }
    return false;
  };

  const totalSelected = selectedMap.size;
  const totalQuantity = Array.from(selectedMap.values()).reduce((s, e) => s + e.quantity, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle>添加产品到报价单</DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 min-h-0 border-t overflow-hidden">
          {/* Left Panel - Category Navigation */}
          <div className="w-[220px] border-r bg-muted/20">
            <ScrollArea className="h-full">
              <div className="p-2">
                {categoryNavGroups.map(({ category, subcategories }) => {
                  const Icon = CATEGORY_ICONS[category.category.id] || Package;
                  const hasSubs = subcategories.length > 0;
                  const isWired = category.category.id === "wired-network";
                  const isExpanded = isWired ? wiredExpanded : false;

                  if (hasSubs) {
                    return (
                      <Collapsible
                        key={category.category.id}
                        open={isExpanded}
                        onOpenChange={isWired ? setWiredExpanded : undefined}
                      >
                        <CollapsibleTrigger asChild>
                          <button
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-accent/50 ${
                              isNavActive(category) ? "bg-accent text-accent-foreground" : ""
                            }`}
                            onClick={() => setActiveNav(category)}
                          >
                            <Icon className="w-4 h-4 shrink-0" />
                            <span className="flex-1 text-left truncate">{category.category.label}</span>
                            <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-auto">
                              {category.totalCount}
                            </Badge>
                            <ChevronRight className={`w-3.5 h-3.5 shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="ml-4 pl-3 border-l border-border space-y-0.5 mt-1">
                            {subcategories.map(sub => (
                              <button
                                key={sub.type === "subcategory" ? sub.subcategory.id : sub.category.id}
                                className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors hover:bg-accent/50 ${
                                  isNavActive(sub) ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground"
                                }`}
                                onClick={() => setActiveNav(sub)}
                              >
                                {sub.type === "subcategory" ? sub.subcategory.label : sub.category.label}
                              </button>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  }

                  return (
                    <button
                      key={category.category.id}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors hover:bg-accent/50 ${
                        isNavActive(category) ? "bg-accent text-accent-foreground font-medium" : ""
                      }`}
                      onClick={() => setActiveNav(category)}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="flex-1 text-left truncate">{category.category.label}</span>
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                        {category.totalCount}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Right Panel - Product List */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Search Bar */}
            <div className="flex items-center gap-2 px-4 py-3 border-b">
              {activeNav && (
                <Badge variant="outline" className="text-xs shrink-0">
                  {activeNav.type === "subcategory"
                    ? `${activeNav.category.label} / ${activeNav.subcategory.label}`
                    : activeNav.category.label}
                </Badge>
              )}
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="搜索产品型号、说明..."
                  value={searchText}
                  onChange={e => handleSearchChange(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
                {searchText && (
                  <button
                    onClick={() => { setSearchText(""); setDebouncedSearch(""); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Product Table */}
            <ScrollArea className="flex-1 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="w-10 text-xs">
                      <input
                        type="checkbox"
                        checked={filteredProducts.length > 0 && filteredProducts.every(p => selectedMap.has(p.id))}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </TableHead>
                    <TableHead className="text-xs font-semibold min-w-[140px]">产品型号</TableHead>
                    <TableHead className="text-xs font-semibold min-w-[200px]">产品说明</TableHead>
                    <TableHead className="text-xs font-semibold w-24">媒体价</TableHead>
                    <TableHead className="text-xs font-semibold w-20">数量</TableHead>
                    <TableHead className="text-xs font-semibold w-16">状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productsQuery.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : filteredProducts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-muted-foreground text-sm">
                        {debouncedSearch ? "未找到匹配产品" : "该分类下暂无产品"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProducts.map((p: any) => {
                      const isSelected = selectedMap.has(p.id);
                      const isExisting = existingProductIds.has(p.id);
                      return (
                        <TableRow
                          key={p.id}
                          className={`transition-colors ${
                            isExisting
                              ? "opacity-50 cursor-not-allowed"
                              : isSelected
                                ? "bg-primary/10 cursor-pointer"
                                : "hover:bg-accent/30 cursor-pointer"
                          }`}
                          onClick={() => !isExisting && toggleProduct(p)}
                        >
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => !isExisting && toggleProduct(p)}
                              disabled={isExisting}
                              className="w-4 h-4 cursor-pointer"
                            />
                          </TableCell>
                          <TableCell className="text-xs font-medium">{p.productModel}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">{p.productDesc}</TableCell>
                          <TableCell className="text-xs tabular-nums">
                            {p.listPrice ? `¥${Number(p.listPrice).toLocaleString()}` : "-"}
                          </TableCell>
                          <TableCell>
                            {isSelected ? (
                              <Input
                                type="number"
                                min={1}
                                value={selectedMap.get(p.id)?.quantity ?? 1}
                                onChange={e => updateQuantity(p.id, Math.max(1, parseInt(e.target.value) || 1))}
                                onClick={e => e.stopPropagation()}
                                className="h-7 w-16 text-xs text-right"
                              />
                            ) : isExisting ? (
                              <span className="text-[10px] text-muted-foreground">已添加</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {isExisting ? (
                              <Badge variant="outline" className="text-[10px] h-5 px-1.5 text-muted-foreground">已添加</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                                {p.productStatus || "-"}
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t bg-background shrink-0 gap-3">
          <span className="text-xs text-muted-foreground">
            已选择 {totalSelected} 个产品{totalQuantity > totalSelected && `，共 ${totalQuantity} 件`}
          </span>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="text-xs">取消</Button>
            <Button onClick={handleAddProducts} disabled={totalSelected === 0} className="text-xs">
              添加到报价单
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
