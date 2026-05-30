import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import EmptyState from "@/components/EmptyState";
import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import {
  ClipboardList, Upload, Trash2, ArrowLeft, Plus, X, Search,
  Loader2, Edit2, Check,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useMobilePreview } from "@/contexts/MobilePreviewContext";

export default function ProductSpecsPage() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const isMobilePreview = useMobilePreview();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page] = useState(1);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check if we're on a detail page
  const pathParts = window.location.pathname.split("/");
  const setId = pathParts[2] ? parseInt(pathParts[2]) : null;

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(value), 300);
  }, []);

  if (setId && !isNaN(setId)) {
    return <SpecSetDetail setId={setId} onBack={() => setLocation("/data")} />;
  }

  return <SpecSetList search={debouncedSearch} page={page} onSearchChange={handleSearchChange} searchValue={search} />;
}

// ==================== List View ====================

export function SpecSetList({ search, page, onSearchChange, searchValue }: {
  search: string; page: number; onSearchChange: (v: string) => void; searchValue: string;
}) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [deleteOpen, setDeleteOpen] = useState<number | null>(null);

  const setsQuery = trpc.productSpecs.listSets.useQuery({
    search: search || undefined,
    page,
    pageSize: 20,
  });

  const deleteMutation = trpc.productSpecs.deleteSet.useMutation({
    onSuccess: () => { toast.success(t('common.saved')); setsQuery.refetch(); },
    onError: (err: any) => toast.error(err.message),
  });

  const sets = setsQuery.data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <ClipboardList className="w-5 h-5" />
            {t('techSpecs.title')}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">{t('techSpecs.uploadDesc')}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('techSpecs.searchPlaceholder')}
              value={searchValue}
              onChange={e => onSearchChange(e.target.value)}
              className="pl-9 h-9 text-sm w-48 bg-background"
            />
          </div>
          <Button size="sm" onClick={() => setLocation("/import")}>
            <Upload className="w-4 h-4 mr-1" />
            {t('techSpecs.upload')}
          </Button>
        </div>
      </div>

      {setsQuery.isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : sets.length === 0 ? (
        <EmptyState icon={ClipboardList} title={t('techSpecs.noSets')} description={t('techSpecs.noSetsDesc')} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sets.map((set: any) => (
            <Card key={set.id} className="hover:shadow-md transition-all cursor-pointer group" onClick={() => setLocation(`/data/specs/${set.id}`)}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{set.name}</p>
                    {set.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{set.description}</p>}
                  </div>
                  <Button
                    variant="ghost" size="sm"
                    className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                    onClick={e => { e.stopPropagation(); setDeleteOpen(set.id); }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <Badge variant="secondary" className="text-[10px]">
                    {t('techSpecs.modelCount', { count: set.modelCount })}
                  </Badge>
                  {set.fileName && (
                    <span className="text-[10px] text-muted-foreground truncate">{set.fileName}</span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">
                  {new Date(set.createdAt).toLocaleDateString("zh-CN", { year: "numeric", month: "short", day: "numeric" })}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={deleteOpen !== null} onOpenChange={() => setDeleteOpen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('techSpecs.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>{t('techSpecs.confirmDeleteDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deleteOpen) deleteMutation.mutate({ id: deleteOpen }); setDeleteOpen(null); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >{t('common.delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ==================== Detail View ====================

export function SpecSetDetail({ setId, onBack }: { setId: number; onBack: () => void }) {
  const { t } = useTranslation();
  const isMobilePreview = useMobilePreview();
  const [search, setSearch] = useState("");
  const [editEntry, setEditEntry] = useState<any>(null);
  const [addOpen, setAddOpen] = useState(false);

  const setQuery = trpc.productSpecs.getSetById.useQuery({ id: setId });
  const deleteEntryMutation = trpc.productSpecs.deleteEntry.useMutation({
    onSuccess: () => { setQuery.refetch(); },
    onError: (err: any) => toast.error(err.message),
  });

  const set = setQuery.data;
  const entries = (setQuery.data?.entries ?? []).filter((e: any) =>
    !search || e.productModel.toLowerCase().includes(search.toLowerCase())
  );

  // Collect all unique spec keys for dynamic columns
  const specKeys = entries.reduce((keys: string[], e: any) => {
    for (const k of Object.keys(e.specs || {})) {
      if (!keys.includes(k)) keys.push(k);
    }
    return keys;
  }, []);

  if (setQuery.isLoading) {
    return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!set) {
    return <EmptyState icon={ClipboardList} title={t('techSpecs.noSpecData')} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            {t('techSpecs.backToList')}
          </Button>
          <div>
            <h1 className="text-lg font-semibold text-foreground">{set.name}</h1>
            <p className="text-xs text-muted-foreground">
              {t('techSpecs.modelCount', { count: set.modelCount })}
              {set.fileName && ` · ${set.fileName}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder={t('techSpecs.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-9 text-sm w-48 bg-background"
          />
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="w-4 h-4 mr-1" />
            {t('techSpecs.addEntry')}
          </Button>
        </div>
      </div>

      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]" style={{ tableLayout: "auto" }}>
            <thead>
              <tr className="bg-muted/30 border-b">
                <th className="text-xs font-semibold px-4 py-2.5 text-left w-12">#</th>
                <th className="text-xs font-semibold px-4 py-2.5 text-left w-48">{t('techSpecs.productModel')}</th>
                <th className="text-xs font-semibold px-4 py-2.5 text-left w-48">{t('techSpecs.productDesc')}</th>
                {specKeys.slice(0, isMobilePreview ? 3 : 10).map((key: string) => (
                  <th key={key} className="text-xs font-semibold px-4 py-2.5 text-left whitespace-nowrap">{key}</th>
                ))}
                {(isMobilePreview ? specKeys.length > 3 : specKeys.length > 10) && (
                  <th className="text-xs font-semibold px-4 py-2.5 text-left">...</th>
                )}
                <th className="text-xs font-semibold px-4 py-2.5 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr><td colSpan={4 + specKeys.length} className="h-32 text-center text-muted-foreground text-sm">{t('techSpecs.noSpecData')}</td></tr>
              ) : entries.map((entry: any, idx: number) => (
                <tr key={entry.id} className="border-b border-border/50 hover:bg-accent/20">
                  <td className="px-4 py-2 text-xs text-muted-foreground">{idx + 1}</td>
                  <td className="px-4 py-2 text-sm font-medium text-foreground">{entry.productModel}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground max-w-[200px] truncate">{entry.productDesc || "—"}</td>
                  {specKeys.slice(0, isMobilePreview ? 3 : 10).map((key: string) => (
                    <td key={key} className="px-4 py-2 text-xs text-foreground whitespace-nowrap">{entry.specs?.[key] || "—"}</td>
                  ))}
                  {(isMobilePreview ? specKeys.length > 3 : specKeys.length > 10) && (
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      +{Object.keys(entry.specs || {}).length - (isMobilePreview ? 3 : 10)}
                    </td>
                  )}
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditEntry(entry)}>
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deleteEntryMutation.mutate({ id: entry.id })}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editEntry && (
        <EditEntryDialog entry={editEntry} set={set} onClose={() => { setEditEntry(null); setQuery.refetch(); }} />
      )}

      {addOpen && (
        <AddEntryDialog setId={setId} onClose={() => { setAddOpen(false); setQuery.refetch(); }} />
      )}
    </div>
  );
}

// ==================== Edit Entry Dialog ====================

function EditEntryDialog({ entry, set, onClose }: { entry: any; set: any; onClose: () => void }) {
  const { t } = useTranslation();
  const [specs, setSpecs] = useState<Record<string, string>>(entry.specs || {});
  const [productDesc, setProductDesc] = useState(entry.productDesc || "");
  const [newKey, setNewKey] = useState("");

  const updateMutation = trpc.productSpecs.updateEntry.useMutation({
    onSuccess: () => { toast.success(t('common.saved')); onClose(); },
    onError: (err: any) => toast.error(err.message),
  });

  const handleSave = () => {
    updateMutation.mutate({ id: entry.id, specs, productDesc });
  };

  const addParam = () => {
    if (newKey.trim() && !specs[newKey.trim()]) {
      setSpecs({ ...specs, [newKey.trim()]: "" });
      setNewKey("");
    }
  };

  const removeParam = (key: string) => {
    const next = { ...specs };
    delete next[key];
    setSpecs(next);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{entry.productModel} — {t('techSpecs.editEntry')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[50vh] overflow-y-auto">
          <div>
            <label className="text-xs font-medium text-muted-foreground">{t('techSpecs.productDesc')}</label>
            <Input value={productDesc} onChange={e => setProductDesc(e.target.value)} className="mt-1 h-8 text-sm" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">{t('techSpecs.title')}</label>
            {Object.entries(specs).map(([key, value]) => (
              <div key={key} className="flex items-center gap-2">
                <span className="text-xs font-medium w-28 shrink-0 truncate" title={key}>{key}</span>
                <Input value={value} onChange={e => setSpecs({ ...specs, [key]: e.target.value })} className="h-7 text-xs flex-1" />
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => removeParam(key)}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ))}
            <div className="flex items-center gap-2 mt-2">
              <Input placeholder={t('techSpecs.paramKey')} value={newKey} onChange={e => setNewKey(e.target.value)} className="h-7 text-xs w-28" />
              <Button variant="outline" size="sm" onClick={addParam} className="h-7 text-xs">
                <Plus className="w-3 h-3 mr-1" />{t('techSpecs.addParam')}
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== Add Entry Dialog ====================

function AddEntryDialog({ setId, onClose }: { setId: number; onClose: () => void }) {
  const { t } = useTranslation();
  const [productModel, setProductModel] = useState("");
  const [productDesc, setProductDesc] = useState("");
  const [specs, setSpecs] = useState<Record<string, string>>({});
  const [newKey, setNewKey] = useState("");

  const addMutation = trpc.productSpecs.addEntry.useMutation({
    onSuccess: () => { toast.success(t('common.saved')); onClose(); },
    onError: (err: any) => toast.error(err.message),
  });

  const handleSave = () => {
    if (!productModel.trim()) return;
    addMutation.mutate({ setId, productModel: productModel.trim(), productDesc: productDesc || undefined, specs });
  };

  const addParam = () => {
    if (newKey.trim()) {
      setSpecs({ ...specs, [newKey.trim()]: "" });
      setNewKey("");
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('techSpecs.addEntry')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder={t('techSpecs.productModel')} value={productModel} onChange={e => setProductModel(e.target.value)} />
          <Input placeholder={t('techSpecs.productDesc')} value={productDesc} onChange={e => setProductDesc(e.target.value)} />
          {Object.entries(specs).map(([key, value]) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-xs font-medium w-28 shrink-0">{key}</span>
              <Input value={value} onChange={e => setSpecs({ ...specs, [key]: e.target.value })} className="h-7 text-xs flex-1" />
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => { const n = { ...specs }; delete n[key]; setSpecs(n); }}>
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <Input placeholder={t('techSpecs.paramKey')} value={newKey} onChange={e => setNewKey(e.target.value)} className="h-7 text-xs w-28" />
            <Button variant="outline" size="sm" onClick={addParam} className="h-7 text-xs">
              <Plus className="w-3 h-3 mr-1" />{t('techSpecs.addParam')}
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={handleSave} disabled={!productModel.trim() || addMutation.isPending}>
            {addMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
