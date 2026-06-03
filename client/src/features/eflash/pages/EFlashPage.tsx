import { useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { hasPermission, PERMISSIONS } from "@shared/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Upload, Search, Zap, X } from "lucide-react";
import { EFlashTable } from "@/features/eflash/components/EFlashTable";
import { EFlashDetailSheet } from "@/features/eflash/components/EFlashDetailSheet";
import { EFlashFormDialog } from "@/features/eflash/components/EFlashFormDialog";
import { EFlashImportDialog } from "@/features/eflash/components/EFlashImportDialog";
import TablePagination from "@/components/TablePagination";

const TYPE_OPTIONS = ["phase_in", "phase_out", "service", "pricing", "program"] as const;
const DIVISION_OPTIONS = ["communications", "network", "general"] as const;
const SCOPE_OPTIONS = ["global", "china"] as const;

export default function EFlashPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const utils = trpc.useUtils();

  // Filter state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [type, setType] = useState<string>("");
  const [division, setDivision] = useState<string>("");
  const [scope, setScope] = useState<string>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  // Dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  const canManage = user ? hasPermission(user, PERMISSIONS.EFLASH_MANAGE) : false;

  // Debounce search
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
    }, 300);
  }, []);

  // Query
  const { data, isLoading } = trpc.eflash.list.useQuery({
    page,
    pageSize,
    type: (type || undefined) as "phase_in" | "phase_out" | "service" | "pricing" | "program" | undefined,
    division: (division || undefined) as "communications" | "network" | "general" | undefined,
    scope: (scope || undefined) as "global" | "china" | undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    search: search || undefined,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleCreate = () => {
    setEditId(null);
    setFormOpen(true);
  };

  const handleEdit = (id: number) => {
    setEditId(id);
    setFormOpen(true);
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setEditId(null);
  };

  const handleFormSave = () => {
    setFormOpen(false);
    setEditId(null);
    utils.eflash.list.invalidate();
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Zap className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold text-foreground">
            {t("eflash.title")}
          </h1>
          {total > 0 && (
            <Badge variant="secondary" className="font-normal text-xs">
              {total}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <>
              <Button size="sm" onClick={handleCreate}>
                <Plus className="w-4 h-4 mr-1" />
                {t("eflash.actions.create")}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
                <Upload className="w-4 h-4 mr-1" />
                {t("eflash.actions.importExcel")}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={type} onValueChange={(v) => { setType(v === "__all__" ? "" : v); setPage(1); }}>
          <SelectTrigger className="h-9 w-32">
            <SelectValue placeholder={t("eflash.filters.allTypes")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("eflash.filters.allTypes")}</SelectItem>
            {TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt}>{t(`eflash.types.${opt}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={division} onValueChange={(v) => { setDivision(v === "__all__" ? "" : v); setPage(1); }}>
          <SelectTrigger className="h-9 w-32">
            <SelectValue placeholder={t("eflash.filters.allDivisions")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("eflash.filters.allDivisions")}</SelectItem>
            {DIVISION_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt}>{t(`eflash.divisions.${opt}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={scope} onValueChange={(v) => { setScope(v === "__all__" ? "" : v); setPage(1); }}>
          <SelectTrigger className="h-9 w-28">
            <SelectValue placeholder={t("eflash.filters.allScopes")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("eflash.filters.allScopes")}</SelectItem>
            {SCOPE_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt}>{t(`eflash.scopes.${opt}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{t("eflash.filters.dateRange")}:</span>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="h-9 w-36 text-sm"
          />
          <span>-</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="h-9 w-36 text-sm"
          />
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t("eflash.filters.searchPlaceholder")}
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 h-9 text-sm w-56 bg-background"
          />
          {searchInput && (
            <button
              onClick={() => { setSearchInput(""); setSearch(""); setPage(1); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
          {t("common.loading")}
        </div>
      ) : (
        <>
          <EFlashTable
            items={items}
            canManage={canManage}
            onViewDetail={(id) => setDetailId(id)}
            onEdit={handleEdit}
            onDelete={() => {}}
          />
          <TablePagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        </>
      )}

      {/* Form Dialog */}
      <EFlashFormDialog
        open={formOpen}
        onClose={handleFormClose}
        onSave={handleFormSave}
        editId={editId}
      />

      {/* Import Dialog */}
      <EFlashImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => utils.eflash.list.invalidate()}
      />

      {/* Detail Sheet */}
      <EFlashDetailSheet
        open={detailId !== null}
        onClose={() => setDetailId(null)}
        recordId={detailId}
        onEdit={(id) => { setDetailId(null); handleEdit(id); }}
      />
    </div>
  );
}
