import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search, X, Loader2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

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
  const [selectedSheet, setSelectedSheet] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedMap, setSelectedMap] = useState<Map<number, { product: any; quantity: number }>>(new Map());
  const [searchTimer, setSearchTimer] = useState<NodeJS.Timeout | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedSheet(null);
      setSearchText("");
      setDebouncedSearch("");
      setSelectedMap(new Map());
    }
  }, [open]);

  // Fetch sheets
  const sheetsQuery = trpc.cpl.sheets.useQuery(undefined, { enabled: open });

  // Get unique sheet names for tabs
  const sheetNames = useMemo(() => {
    if (!sheetsQuery.data) return [];
    return sheetsQuery.data.map(s => s.sheetName).filter((name, index, arr) => arr.indexOf(name) === index);
  }, [sheetsQuery.data]);

  // Auto-select first sheet when data loads
  useEffect(() => {
    if (sheetNames.length > 0 && !selectedSheet) {
      setSelectedSheet(sheetNames[0]);
    }
  }, [sheetNames, selectedSheet]);

  // Fetch products for selected sheet
  const productsQuery = trpc.cpl.products.useQuery(
    { sheetName: selectedSheet || undefined, search: debouncedSearch || undefined, pageSize: 200 },
    { enabled: open && !!selectedSheet }
  );

  // Filter products by search
  const filteredProducts = useMemo(() => {
    const products = productsQuery.data?.items || [];
    if (!debouncedSearch) return products;
    const lowerSearch = debouncedSearch.toLowerCase();
    return products.filter((p: any) =>
      (p.productModel?.toLowerCase().includes(lowerSearch) ||
        p.productDesc?.toLowerCase().includes(lowerSearch))
    );
  }, [productsQuery.data?.items, debouncedSearch]);

  // Handle search with debounce
  const handleSearchChange = useCallback((value: string) => {
    setSearchText(value);
    if (searchTimer) clearTimeout(searchTimer);
    const timer = setTimeout(() => {
      setDebouncedSearch(value);
    }, 300);
    setSearchTimer(timer);
  }, [searchTimer]);

  // Toggle product selection
  const toggleProduct = useCallback((product: any) => {
    const newMap = new Map(selectedMap);
    if (newMap.has(product.id)) {
      newMap.delete(product.id);
    } else {
      newMap.set(product.id, { product, quantity: 1 });
    }
    setSelectedMap(newMap);
  }, [selectedMap]);

  // Update quantity
  const updateQuantity = useCallback((productId: number, quantity: number) => {
    const newMap = new Map(selectedMap);
    const item = newMap.get(productId);
    if (item) {
      newMap.set(productId, { ...item, quantity });
      setSelectedMap(newMap);
    }
  }, [selectedMap]);

  // Toggle select all
  const toggleSelectAll = useCallback(() => {
    if (filteredProducts.length === 0) return;
    const newMap = new Map(selectedMap);
    const allSelected = filteredProducts.every((p: any) => newMap.has(p.id));

    if (allSelected) {
      filteredProducts.forEach((p: any) => newMap.delete(p.id));
    } else {
      filteredProducts.forEach((p: any) => {
        if (!newMap.has(p.id) && !existingProductIds.has(p.id)) {
          newMap.set(p.id, { product: p, quantity: 1 });
        }
      });
    }
    setSelectedMap(newMap);
  }, [filteredProducts, selectedMap, existingProductIds]);

  // Handle add products
  const handleAddProducts = useCallback(() => {
    const products = Array.from(selectedMap.values());
    if (products.length > 0) {
      onAddProducts(products);
      onOpenChange(false);
    }
  }, [selectedMap, onAddProducts, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>添加产品到报价单</DialogTitle>
        </DialogHeader>

        {/* Sheet Tabs */}
        <div className="flex gap-1 border-b overflow-x-auto px-4">
          {sheetNames.map(sheet => (
            <button
              key={sheet}
              onClick={() => setSelectedSheet(sheet)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                selectedSheet === sheet
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {sheet}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="px-4 pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="搜索产品型号、说明..."
              value={searchText}
              onChange={e => handleSearchChange(e.target.value)}
              className="pl-10 pr-8"
            />
            {searchText && (
              <button
                onClick={() => handleSearchChange("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Product Table */}
        <ScrollArea className="flex-1 overflow-hidden px-4">
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
                filteredProducts.map((p: any, index: number) => {
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

        {/* Footer */}
        <DialogFooter className="px-4 py-4 border-t">
          <div className="flex items-center justify-between w-full">
            <span className="text-sm text-muted-foreground">
              已选择 {selectedMap.size} 个产品
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button onClick={handleAddProducts} disabled={selectedMap.size === 0}>
                添加到报价单
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
