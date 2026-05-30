import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  X,
  Loader2,
  ChevronRight,
  ChevronLeft,
  ClipboardList,
  Lock,
  LockOpen,
  Save,
} from "lucide-react";
import TablePagination from "@/components/TablePagination";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

export const SPEC_CATEGORIES = [
  { id: "stellar", label: "OmniAccess Stellar", keywords: ["stellar", "omniaccess stellar"] },
  { id: "omniswitch", label: "OmniSwitch", keywords: ["omniswitch"] },
  { id: "omniswitch-2960", label: "OmniSwitch (2960 2560 2160)", keywords: ["2960", "2560", "2160"] },
  { id: "omniswitch-industrial", label: "OmniSwitch (工业)", keywords: ["工业"] },
  { id: "esr", label: "OmniAccess ESR", keywords: ["esr", "omniaccess esr"] },
  { id: "vista", label: "OmniAccess Vista2500", keywords: ["vista", "vista2500"] },
];

export const SPEC_COLUMNS = [
  { key: "index", label: "#", defaultWidth: 56, sortable: false },
  { key: "productModel", label: "型号", defaultWidth: 180, sortable: true },
  { key: "briefSpecs", label: "简要参数", defaultWidth: 600, sortable: true },
] as const;

export function SpecDataTab() {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("stellar");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [locked, setLocked] = useState(true);
  const [editedEntries, setEditedEntries] = useState<Record<number, Record<string, string>>>({});
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem("ale-cpl-spec-sidebar-collapsed") === "true"; } catch { return false; }
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [allEntries, setAllEntries] = useState<any[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const defaults: Record<string, number> = {};
    SPEC_COLUMNS.forEach(c => { defaults[c.key] = c.defaultWidth; });
    return defaults;
  });
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);

  const setsQuery = trpc.productSpecs.listSets.useQuery({ page: 1, pageSize: 100 });
  const sets = setsQuery.data?.items ?? [];

  // Match sets to categories with priority (specific subcategories before generic)
  const categorySetIds = useMemo(() => {
    const result: Record<string, number[]> = {};
    const assigned = new Set<number>();
    const priorityOrder = [
      SPEC_CATEGORIES.find(c => c.id === 'omniswitch-2960')!,
      SPEC_CATEGORIES.find(c => c.id === 'omniswitch-industrial')!,
      SPEC_CATEGORIES.find(c => c.id === 'stellar')!,
      SPEC_CATEGORIES.find(c => c.id === 'esr')!,
      SPEC_CATEGORIES.find(c => c.id === 'vista')!,
      SPEC_CATEGORIES.find(c => c.id === 'omniswitch')!,
    ];
    for (const cat of priorityOrder) {
      result[cat.id] = [];
      for (const set of sets) {
        if (assigned.has(set.id)) continue;
        const name = set.name.toLowerCase();
        if (cat.keywords.some(kw => name.includes(kw.toLowerCase()))) {
          result[cat.id].push(set.id);
          assigned.add(set.id);
        }
      }
    }
    return result;
  }, [sets]);

  // Total entries per category (for sidebar badges)
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const cat of SPEC_CATEGORIES) {
      counts[cat.id] = (categorySetIds[cat.id] || []).reduce((sum, setId) => {
        const set = sets.find((s: any) => s.id === setId);
        return sum + (set?.modelCount || 0);
      }, 0);
    }
    return counts;
  }, [sets, categorySetIds]);

  // Fetch entries for all matching sets when category changes
  const matchingSetIds = useMemo(
    () => categorySetIds[selectedCategoryId] || [],
    [selectedCategoryId, categorySetIds],
  );

  useEffect(() => {
    if (matchingSetIds.length === 0 || setsQuery.isLoading) {
      setAllEntries([]);
      return;
    }
    let cancelled = false;
    setEntriesLoading(true);
    Promise.all(
      matchingSetIds.map(id => utils.productSpecs.getSetById.fetch({ id }))
    ).then(results => {
      if (!cancelled) {
        setAllEntries(results.flatMap((r: any) => r?.entries ?? []));
        setEntriesLoading(false);
      }
    }).catch(() => { if (!cancelled) setEntriesLoading(false); });
    return () => { cancelled = true; };
  }, [matchingSetIds.join(','), setsQuery.isLoading, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateMutation = trpc.productSpecs.updateEntry.useMutation({
    onSuccess: () => {
      toast.success(t('common.saved'));
      setEditedEntries({});
      utils.productSpecs.getSetById.invalidate();
      setRefreshKey(k => k + 1);
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Column resize handlers
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

  const handleResizeStart = (colKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    setResizingColumn(colKey);
    setResizeStartX(e.clientX);
    setResizeStartWidth(columnWidths[colKey] || 100);
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  };

  const getSortIcon = (column: string) => {
    if (sortBy !== column) return <ChevronsUpDown className="w-3 h-3 text-muted-foreground/40" />;
    return sortOrder === "asc" ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />;
  };

  const handleSelectCategory = (catId: string) => {
    setSelectedCategoryId(catId);
    setSearch(""); setDebouncedSearch(""); setEditedEntries({}); setPage(1); setSortBy(undefined);
  };

  // Filter → Sort → Paginate
  const filteredEntries = useMemo(() => {
    let entries = allEntries.filter((e: any) =>
      !debouncedSearch || e.productModel.toLowerCase().includes(debouncedSearch.toLowerCase())
    );
    if (sortBy === "productModel") {
      entries.sort((a: any, b: any) => {
        const cmp = a.productModel.localeCompare(b.productModel);
        return sortOrder === "asc" ? cmp : -cmp;
      });
    } else if (sortBy === "briefSpecs") {
      entries.sort((a: any, b: any) => {
        const sa = a.productDesc || '';
        const sb = b.productDesc || '';
        return sortOrder === "asc" ? sa.localeCompare(sb) : sb.localeCompare(sa);
      });
    }
    return entries;
  }, [allEntries, debouncedSearch, sortBy, sortOrder]);

  const total = filteredEntries.length;
  const totalPages = Math.ceil(total / pageSize);
  const paginatedEntries = useMemo(() =>
    filteredEntries.slice((page - 1) * pageSize, page * pageSize),
    [filteredEntries, page, pageSize],
  );

  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => { setPage(1); }, [pageSize]);

  const handleSave = () => {
    for (const [id, specs] of Object.entries(editedEntries)) {
      const entry = allEntries.find((e: any) => e.id === Number(id));
      updateMutation.mutate({ id: Number(id), specs, productDesc: entry?.productDesc });
    }
  };

  const handleCancel = () => { setEditedEntries({}); setLocked(true); };

  const updateSpec = (entryId: number, key: string, value: string) => {
    setEditedEntries(prev => {
      const entry = allEntries.find((e: any) => e.id === entryId);
      const base = prev[entryId] || { ...(entry?.specs || {}) };
      return { ...prev, [entryId]: { ...base, [key]: value } };
    });
  };

  const getSpecs = (entry: any): Record<string, string> => {
    return editedEntries[entry.id] || entry.specs || {};
  };

  const selectedCategory = SPEC_CATEGORIES.find(c => c.id === selectedCategoryId);

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Sidebar - Fixed Categories */}
      <div className={`${sidebarCollapsed ? "w-0" : "w-64"} transition-all duration-300 overflow-hidden flex flex-col border-r bg-muted`}>
        <div className="p-4 border-b">
          <h2 className="text-sm font-semibold text-foreground">{t('data.specCategories')}</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {setsQuery.isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : SPEC_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => handleSelectCategory(cat.id)}
              className={`w-full px-4 py-2.5 text-left text-sm font-medium transition-colors flex items-center justify-between border-b ${
                selectedCategoryId === cat.id
                  ? "bg-primary/10 text-primary border-l-2 border-primary"
                  : "text-foreground hover:bg-accent"
              }`}
            >
              <span className="flex-1 truncate">{cat.label}</span>
              <Badge variant="secondary" className="text-xs ml-2 shrink-0">{categoryCounts[cat.id] || 0}</Badge>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header with sidebar toggle */}
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-background shrink-0">
          <Button variant="ghost" size="sm" onClick={() => { const v = !sidebarCollapsed; setSidebarCollapsed(v); localStorage.setItem("ale-cpl-spec-sidebar-collapsed", String(v)); }} className="-ml-2" title={sidebarCollapsed ? t('data.expandCategory') : t('data.collapseCategory')}>
            {sidebarCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </Button>
        </div>

        <div className="flex-1 flex flex-col gap-3 overflow-hidden px-6 py-4">
          {/* Header */}
          <div className="flex items-center justify-between gap-4 flex-wrap shrink-0">
            <div className="flex items-center gap-3">
              <ClipboardList className="w-5 h-5 text-primary" />
              <h1 className="text-lg font-semibold text-foreground">
                {selectedCategory?.label || t('data.tabSpec')}
              </h1>
              {total > 0 && (
                <Badge variant="secondary" className="font-normal text-xs">
                  {total} {t('techSpecs.models')}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder={t('techSpecs.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-64 h-9 text-sm bg-background" />
                {search && (
                  <button onClick={() => { setSearch(""); setDebouncedSearch(""); setPage(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {matchingSetIds.length > 0 && (
                <button
                  onClick={() => { if (!locked) { setEditedEntries({}); } setLocked(!locked); }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-md border text-xs font-medium transition-colors h-9 ${
                    locked
                      ? "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                      : "border-primary/40 text-primary bg-primary/5"
                  }`}
                  title={locked ? t('data.unlockEdit') : t('data.lockReadonly')}
                >
                  {locked ? <Lock className="w-3.5 h-3.5" /> : <LockOpen className="w-3.5 h-3.5" />}
                  {locked ? t('data.readonly') : t('data.editing')}
                </button>
              )}
              {!locked && Object.keys(editedEntries).length > 0 && (
                <>
                  <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending} className="h-9 gap-1.5">
                    {updateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {t('common.save')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleCancel} className="h-9 gap-1.5">
                    {t('common.cancel')}
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Data table */}
          <div className="flex-1 border rounded-lg bg-card overflow-hidden flex flex-col min-h-0">
            <div className="overflow-auto flex-1 min-h-0">
              <table style={{ width: 'max-content', minWidth: '100%', tableLayout: 'fixed' }}>
                <thead className="sticky top-0 bg-muted/30 z-10">
                  <tr className="border-b">
                    {SPEC_COLUMNS.map((col, ci) => (
                      <th
                        key={col.key}
                        className={`px-3 py-2 text-xs font-semibold text-left border-r border-border/50 relative group select-none ${
                          col.sortable ? "cursor-pointer hover:text-foreground" : ""
                        } ${ci === SPEC_COLUMNS.length - 1 ? "last:border-r-0" : ""}`}
                        style={{ width: `${columnWidths[col.key] || col.defaultWidth}px` }}
                        onClick={() => col.sortable && handleSort(col.key)}
                      >
                        <div className="flex items-center gap-1">
                          {col.key === 'productModel' ? t('data.colModel', { defaultValue: col.label }) : col.key === 'briefSpecs' ? t('data.colSpecs', { defaultValue: col.label }) : col.label}
                          {col.sortable && getSortIcon(col.key)}
                        </div>
                        <div
                          onMouseDown={e => handleResizeStart(col.key, e)}
                          className="absolute right-0 top-0 bottom-0 w-1.5 bg-border/0 hover:bg-primary/50 cursor-col-resize transition-colors opacity-0 group-hover:opacity-100"
                        />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entriesLoading ? (
                    <tr>
                      <td colSpan={3} className="h-48 text-center">
                        <div className="flex items-center justify-center gap-2 text-muted-foreground">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm">{t('common.loading')}</span>
                        </div>
                      </td>
                    </tr>
                  ) : paginatedEntries.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="h-48 text-center">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <ClipboardList className="w-8 h-8 opacity-30" />
                          <span className="text-sm">{t('techSpecs.noSpecData')}</span>
                          {debouncedSearch && <span className="text-xs">{t('data.adjustSearchHint')}</span>}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedEntries.map((entry: any, idx: number) => {
                      const specs = getSpecs(entry);
                      const briefText = entry.productDesc
                        || Object.entries(specs).map(([k, v]) => `${k}: ${v}`).join("  |  ");
                      return (
                        <tr key={entry.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                          <td className="px-3 py-2 text-xs text-muted-foreground border-r border-border/50" style={{ width: `${columnWidths.index}px` }}>
                            {(page - 1) * pageSize + idx + 1}
                          </td>
                          <td className="px-3 py-2 text-xs font-medium border-r border-border/50" style={{ width: `${columnWidths.productModel}px` }}>
                            <div className="break-words whitespace-normal">{entry.productModel}</div>
                          </td>
                          <td className="px-3 py-2 text-xs border-r border-border/50 last:border-r-0" style={{ width: `${columnWidths.briefSpecs}px` }}>
                            {locked ? (
                              <span className="text-muted-foreground break-words whitespace-normal">{briefText}</span>
                            ) : (
                              <div className="flex flex-col gap-1">
                                <textarea
                                  value={entry.productDesc || ''}
                                  onChange={e => {
                                    const entryToUpdate = allEntries.find((en: any) => en.id === entry.id);
                                    if (entryToUpdate) entryToUpdate.productDesc = e.target.value;
                                  }}
                                  className="w-full min-h-[60px] text-xs border rounded bg-background p-2 focus:outline-none focus:ring-1 focus:ring-primary resize-y"
                                  placeholder={t('data.productDescription')}
                                />
                                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                                  {Object.entries(specs).map(([key, val]) => (
                                    <div key={key} className="flex items-center gap-1 text-xs">
                                      <span className="text-muted-foreground whitespace-nowrap">{key}:</span>
                                      <input
                                        value={val}
                                        onChange={e => updateSpec(entry.id, key, e.target.value)}
                                        className="h-6 px-1.5 text-xs border rounded bg-background w-24 focus:outline-none focus:ring-1 focus:ring-primary"
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <TablePagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </div>
    </div>
  );
}
