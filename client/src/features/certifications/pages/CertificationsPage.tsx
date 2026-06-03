import { useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { hasPermission, PERMISSIONS, CERT_PRODUCT_CATEGORIES, CERT_STANDARD_TYPES } from "@shared/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, Upload, Download, Search, ShieldCheck, Award, X,
} from "lucide-react";
import { toast } from "sonner";
import { CertificationTable } from "@/features/certifications/components/CertificationTable";
import { CertificationFormDialog } from "@/features/certifications/components/CertificationFormDialog";
import { CertificationImportDialog } from "@/features/certifications/components/CertificationImportDialog";

export default function CertificationsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  // Tab & filters
  const [certType, setCertType] = useState<"product" | "enterprise">("product");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [standardFilter, setStandardFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [keyword, setKeyword] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Dialog states
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [viewOnly, setViewOnly] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const canManage = user ? hasPermission(user, PERMISSIONS.MANAGE_CERTIFICATIONS) : false;
  const utils = trpc.useUtils();

  // Debounce search
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleKeywordChange = useCallback((value: string) => {
    setKeyword(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedKeyword(value);
      setPage(1);
    }, 300);
  }, []);

  // Query for total count badge
  const { data: countData } = trpc.certifications.list.useQuery({
    certType,
    status: statusFilter === "all" ? undefined : statusFilter,
    standardType: standardFilter === "all" ? undefined : standardFilter,
    productCategory: categoryFilter === "all" ? undefined : categoryFilter,
    keyword: debouncedKeyword || undefined,
    page: 1,
    pageSize: 1,
  });

  // Delete mutation
  const deleteMut = trpc.certifications.delete.useMutation({
    onSuccess: () => {
      utils.certifications.list.invalidate();
      toast.success(t("common.success"));
      setDeleteId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  // Export handler
  const [exporting, setExporting] = useState(false);
  const handleExport = async () => {
    setExporting(true);
    try {
      const base64 = await utils.certifications.export.fetch({
        certType,
        status: statusFilter === "all" ? undefined : statusFilter,
        standardType: standardFilter === "all" ? undefined : standardFilter,
        productCategory: categoryFilter === "all" ? undefined : categoryFilter,
        keyword: debouncedKeyword || undefined,
      });
      const byteChars = atob(base64);
      const byteArray = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteArray[i] = byteChars.charCodeAt(i);
      }
      const blob = new Blob([byteArray], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `certifications_${certType}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(t("common.success"));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      toast.error(message);
    } finally {
      setExporting(false);
    }
  };

  const handleTabChange = (value: string) => {
    setCertType(value as "product" | "enterprise");
    setPage(1);
    setStandardFilter("all");
    setCategoryFilter("all");
  };

  const handleCreate = () => {
    setEditId(null);
    setViewOnly(false);
    setFormOpen(true);
  };

  const handleEdit = (id: number) => {
    setEditId(id);
    setViewOnly(false);
    setFormOpen(true);
  };

  const handleView = (id: number) => {
    setEditId(id);
    setViewOnly(true);
    setFormOpen(true);
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setEditId(null);
    setViewOnly(false);
  };

  const handleFormSave = () => {
    setFormOpen(false);
    setEditId(null);
    setViewOnly(false);
    utils.certifications.list.invalidate();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold text-foreground">
            {t("certifications.title")}
          </h1>
          {countData && countData.total > 0 && (
            <Badge variant="secondary" className="font-normal text-xs">
              {countData.total}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <>
              <Button size="sm" onClick={handleCreate}>
                <Plus className="w-4 h-4 mr-1" />
                {t("certifications.actions.add")}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
                <Upload className="w-4 h-4 mr-1" />
                {t("certifications.actions.import")}
              </Button>
            </>
          )}
          <Button size="sm" variant="outline" onClick={handleExport} disabled={exporting}>
            <Download className="w-4 h-4 mr-1" />
            {exporting ? t("common.loading") : t("certifications.actions.export")}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={certType} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="product" className="gap-1.5">
            <Award className="w-4 h-4" />
            {t("certifications.tabs.product")}
          </TabsTrigger>
          <TabsTrigger value="enterprise" className="gap-1.5">
            <ShieldCheck className="w-4 h-4" />
            {t("certifications.tabs.enterprise")}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t("certifications.filters.searchPlaceholder")}
            value={keyword}
            onChange={e => handleKeywordChange(e.target.value)}
            className="pl-9 h-9 text-sm w-56 bg-background"
          />
          {keyword && (
            <button
              onClick={() => { setKeyword(""); setDebouncedKeyword(""); setPage(1); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="h-9 w-36">
            <SelectValue placeholder={t("certifications.filters.allStatus")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("certifications.filters.allStatus")}</SelectItem>
            <SelectItem value="active">{t("certifications.status.active")}</SelectItem>
            <SelectItem value="expired">{t("certifications.status.expired")}</SelectItem>
            <SelectItem value="revoked">{t("certifications.status.revoked")}</SelectItem>
            <SelectItem value="pending">{t("certifications.status.pending")}</SelectItem>
          </SelectContent>
        </Select>
        {certType === "product" && (
          <>
            <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1); }}>
              <SelectTrigger className="h-9 w-36">
                <SelectValue placeholder={t("certifications.filters.allCategories")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("certifications.filters.allCategories")}</SelectItem>
                {CERT_PRODUCT_CATEGORIES.map(c => (
                  <SelectItem key={c} value={c}>{t(`certifications.categories.${c}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={standardFilter} onValueChange={(v) => { setStandardFilter(v); setPage(1); }}>
              <SelectTrigger className="h-9 w-40">
                <SelectValue placeholder={t("certifications.filters.allStandards")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("certifications.filters.allStandards")}</SelectItem>
                {CERT_STANDARD_TYPES.map(s => (
                  <SelectItem key={s} value={s}>{t(`certifications.standards.${s}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
      </div>

      {/* Table */}
      <CertificationTable
        certType={certType}
        status={statusFilter === "all" ? undefined : statusFilter}
        standardType={standardFilter === "all" ? undefined : standardFilter}
        productCategory={categoryFilter === "all" ? undefined : categoryFilter}
        keyword={debouncedKeyword}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={setDeleteId}
        canManage={canManage}
      />

      {/* Form Dialog */}
      <CertificationFormDialog
        open={formOpen}
        onClose={handleFormClose}
        onSave={handleFormSave}
        certType={certType}
        editId={editId}
        readOnly={viewOnly}
      />

      {/* Import Dialog */}
      <CertificationImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => utils.certifications.list.invalidate()}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common.confirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("certifications.actions.confirmDelete")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMut.mutate({ id: deleteId })}
              disabled={deleteMut.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMut.isPending ? t("common.loading") : t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
