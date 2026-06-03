import { useEffect, useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

// ==================== Types ====================

interface EFlashFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  editId: number | null;
}

interface EFlashForm {
  eflashId: string;
  type: string;
  division: string;
  scope: string;
  subjectEn: string;
  subjectCn: string;
  globalDate: string;
  chinaDate: string;
  effectiveDate: string;
  authorEn: string;
  authorCn: string;
  comments: string;
  tagIds: number[];
}

interface TagItem {
  id: number;
  name: string;
  category: "region" | "product";
}

// ==================== Constants ====================

const EFLASH_ID_REGEX = /^EF-[A-Z]\d+.*$/;

const TYPE_OPTIONS = ["phase_in", "phase_out", "service", "pricing", "program"] as const;
const DIVISION_OPTIONS = ["communications", "network", "general"] as const;
const SCOPE_OPTIONS = ["global", "china"] as const;

const EMPTY_FORM: EFlashForm = {
  eflashId: "",
  type: "",
  division: "communications",
  scope: "global",
  subjectEn: "",
  subjectCn: "",
  globalDate: "",
  chinaDate: "",
  effectiveDate: "",
  authorEn: "",
  authorCn: "",
  comments: "",
  tagIds: [],
};

// ==================== Component ====================

export function EFlashFormDialog({ open, onClose, onSave, editId }: EFlashFormDialogProps) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  const [form, setForm] = useState<EFlashForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof EFlashForm, string>>>({});

  // Fetch existing record for edit mode
  const { data: existing, isLoading: loadingExisting } = trpc.eflash.getById.useQuery(
    { id: editId! },
    { enabled: !!editId && open },
  );

  // Fetch all tags for multi-select
  const { data: allTags } = trpc.eflash.listTags.useQuery(undefined, {
    enabled: open,
  });

  // Group tags by category
  const regionTags = useMemo(
    () => (allTags as TagItem[] | undefined)?.filter(tag => tag.category === "region") ?? [],
    [allTags],
  );
  const productTags = useMemo(
    () => (allTags as TagItem[] | undefined)?.filter(tag => tag.category === "product") ?? [],
    [allTags],
  );

  // Populate form when existing data loads (edit mode) or reset (create mode)
  useEffect(() => {
    if (existing) {
      const formatDate = (d: string | Date | null | undefined): string => {
        if (!d) return "";
        const date = typeof d === "string" ? new Date(d) : d;
        if (isNaN(date.getTime())) return "";
        return date.toISOString().slice(0, 10);
      };

      setForm({
        eflashId: existing.eflashId ?? "",
        type: existing.type ?? "",
        division: existing.division ?? "communications",
        scope: existing.scope ?? "global",
        subjectEn: existing.subjectEn ?? "",
        subjectCn: existing.subjectCn ?? "",
        globalDate: formatDate(existing.globalDate),
        chinaDate: formatDate(existing.chinaDate),
        effectiveDate: formatDate(existing.effectiveDate),
        authorEn: existing.authorEn ?? "",
        authorCn: existing.authorCn ?? "",
        comments: existing.comments ?? "",
        tagIds: existing.tags?.map((tag: TagItem) => tag.id) ?? [],
      });
    } else if (!editId && open) {
      setForm(EMPTY_FORM);
    }
    setErrors({});
  }, [existing, editId, open]);

  // Mutations
  const createMut = trpc.eflash.create.useMutation({
    onSuccess: () => {
      utils.eflash.list.invalidate();
      onSave();
      onClose();
      toast.success(t("eflash.form.saveSuccess"));
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMut = trpc.eflash.update.useMutation({
    onSuccess: () => {
      utils.eflash.list.invalidate();
      onSave();
      onClose();
      toast.success(t("eflash.form.saveSuccess"));
    },
    onError: (e) => toast.error(e.message),
  });

  // Validation
  const validate = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof EFlashForm, string>> = {};

    if (!form.eflashId.trim()) {
      newErrors.eflashId = t("eflash.form.validation.eflashIdRequired");
    } else if (!EFLASH_ID_REGEX.test(form.eflashId.trim())) {
      newErrors.eflashId = t("eflash.form.validation.eflashIdFormat");
    }

    if (!form.type) {
      newErrors.type = t("eflash.form.validation.typeRequired");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [form.eflashId, form.type, t]);

  // Submit handler
  const handleSubmit = () => {
    if (!validate()) return;

    const type = form.type as typeof TYPE_OPTIONS[number];
    const division = form.division as typeof DIVISION_OPTIONS[number];
    const scope = form.scope as typeof SCOPE_OPTIONS[number];

    const payload = {
      eflashId: form.eflashId.trim(),
      type,
      division,
      scope,
      subjectEn: form.subjectEn || undefined,
      subjectCn: form.subjectCn || undefined,
      globalDate: form.globalDate || undefined,
      chinaDate: form.chinaDate || undefined,
      effectiveDate: form.effectiveDate || undefined,
      authorEn: form.authorEn || undefined,
      authorCn: form.authorCn || undefined,
      comments: form.comments || undefined,
      tagIds: form.tagIds.length > 0 ? form.tagIds : undefined,
    };

    if (editId) {
      updateMut.mutate({ id: editId, ...payload });
    } else {
      createMut.mutate(payload);
    }
  };

  // Tag toggle
  const handleTagToggle = useCallback((tagId: number, checked: boolean) => {
    setForm(prev => ({
      ...prev,
      tagIds: checked
        ? [...prev.tagIds, tagId]
        : prev.tagIds.filter(id => id !== tagId),
    }));
  }, []);

  // Form field updater helper
  const updateField = useCallback(<K extends keyof EFlashForm>(key: K, value: EFlashForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  const saving = createMut.isPending || updateMut.isPending;
  const title = editId ? t("eflash.form.editTitle") : t("eflash.form.createTitle");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {loadingExisting ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 py-4">
              {/* eFlash ID */}
              <div>
                <Label htmlFor="eflashId">{t("eflash.fields.eflashId")} *</Label>
                <Input
                  id="eflashId"
                  value={form.eflashId}
                  onChange={e => updateField("eflashId", e.target.value)}
                  placeholder="EF-Z001"
                />
                {errors.eflashId && (
                  <p className="text-xs text-destructive mt-1">{errors.eflashId}</p>
                )}
              </div>

              {/* Type */}
              <div>
                <Label htmlFor="eflashType">{t("eflash.fields.type")} *</Label>
                <Select
                  value={form.type}
                  onValueChange={v => updateField("type", v)}
                >
                  <SelectTrigger id="eflashType" className="w-full">
                    <SelectValue placeholder={t("eflash.filters.allTypes")} />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map(opt => (
                      <SelectItem key={opt} value={opt}>
                        {t(`eflash.types.${opt}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.type && (
                  <p className="text-xs text-destructive mt-1">{errors.type}</p>
                )}
              </div>

              {/* Division */}
              <div>
                <Label htmlFor="eflashDivision">{t("eflash.fields.division")}</Label>
                <Select
                  value={form.division}
                  onValueChange={v => updateField("division", v)}
                >
                  <SelectTrigger id="eflashDivision" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIVISION_OPTIONS.map(opt => (
                      <SelectItem key={opt} value={opt}>
                        {t(`eflash.divisions.${opt}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Scope */}
              <div>
                <Label htmlFor="eflashScope">{t("eflash.fields.scope")}</Label>
                <Select
                  value={form.scope}
                  onValueChange={v => updateField("scope", v)}
                >
                  <SelectTrigger id="eflashScope" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCOPE_OPTIONS.map(opt => (
                      <SelectItem key={opt} value={opt}>
                        {t(`eflash.scopes.${opt}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Subject EN */}
              <div className="col-span-2">
                <Label htmlFor="subjectEn">{t("eflash.fields.subjectEn")}</Label>
                <Textarea
                  id="subjectEn"
                  value={form.subjectEn}
                  onChange={e => updateField("subjectEn", e.target.value)}
                  rows={2}
                />
              </div>

              {/* Subject CN */}
              <div className="col-span-2">
                <Label htmlFor="subjectCn">{t("eflash.fields.subjectCn")}</Label>
                <Textarea
                  id="subjectCn"
                  value={form.subjectCn}
                  onChange={e => updateField("subjectCn", e.target.value)}
                  rows={2}
                />
              </div>

              {/* Global Date */}
              <div>
                <Label htmlFor="globalDate">{t("eflash.fields.globalDate")}</Label>
                <Input
                  id="globalDate"
                  type="date"
                  value={form.globalDate}
                  onChange={e => updateField("globalDate", e.target.value)}
                />
              </div>

              {/* China Date */}
              <div>
                <Label htmlFor="chinaDate">{t("eflash.fields.chinaDate")}</Label>
                <Input
                  id="chinaDate"
                  type="date"
                  value={form.chinaDate}
                  onChange={e => updateField("chinaDate", e.target.value)}
                />
              </div>

              {/* Effective Date */}
              <div className="col-span-2">
                <Label htmlFor="effectiveDate">{t("eflash.fields.effectiveDate")}</Label>
                <Input
                  id="effectiveDate"
                  type="date"
                  value={form.effectiveDate}
                  onChange={e => updateField("effectiveDate", e.target.value)}
                />
              </div>

              {/* Author EN */}
              <div>
                <Label htmlFor="authorEn">{t("eflash.fields.authorEn")}</Label>
                <Input
                  id="authorEn"
                  value={form.authorEn}
                  onChange={e => updateField("authorEn", e.target.value)}
                />
              </div>

              {/* Author CN */}
              <div>
                <Label htmlFor="authorCn">{t("eflash.fields.authorCn")}</Label>
                <Input
                  id="authorCn"
                  value={form.authorCn}
                  onChange={e => updateField("authorCn", e.target.value)}
                />
              </div>

              {/* Comments */}
              <div className="col-span-2">
                <Label htmlFor="eflashComments">{t("eflash.fields.comments")}</Label>
                <Textarea
                  id="eflashComments"
                  value={form.comments}
                  onChange={e => updateField("comments", e.target.value)}
                  rows={2}
                />
              </div>

              {/* Tags - Region */}
              {regionTags.length > 0 && (
                <div className="col-span-2">
                  <Label className="mb-2">{t("eflash.tagCategories.region")}</Label>
                  <div className="flex flex-wrap gap-3 mt-1">
                    {regionTags.map(tag => (
                      <label
                        key={tag.id}
                        className="flex items-center gap-2 cursor-pointer text-sm"
                      >
                        <Checkbox
                          checked={form.tagIds.includes(tag.id)}
                          onCheckedChange={checked =>
                            handleTagToggle(tag.id, checked === true)
                          }
                        />
                        <span>{tag.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags - Product */}
              {productTags.length > 0 && (
                <div className="col-span-2">
                  <Label className="mb-2">{t("eflash.tagCategories.product")}</Label>
                  <div className="flex flex-wrap gap-3 mt-1">
                    {productTags.map(tag => (
                      <label
                        key={tag.id}
                        className="flex items-center gap-2 cursor-pointer text-sm"
                      >
                        <Checkbox
                          checked={form.tagIds.includes(tag.id)}
                          onCheckedChange={checked =>
                            handleTagToggle(tag.id, checked === true)
                          }
                        />
                        <span>{tag.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Selected tags summary */}
              {form.tagIds.length > 0 && (
                <div className="col-span-2">
                  <div className="flex flex-wrap gap-1">
                    {form.tagIds.map(tagId => {
                      const tag = [...regionTags, ...productTags].find(t => t.id === tagId);
                      if (!tag) return null;
                      return (
                        <Badge key={tag.id} variant="secondary" className="text-xs">
                          {tag.name}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                {t("common.cancel")}
              </Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving ? t("common.loading") : t("common.save")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
