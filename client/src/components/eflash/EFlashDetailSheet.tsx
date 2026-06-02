import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import { Pencil, Download, FileText } from "lucide-react";

const TYPE_BADGE_COLORS: Record<string, string> = {
  phase_in: "bg-green-100 text-green-800",
  phase_out: "bg-red-100 text-red-800",
  service: "bg-blue-100 text-blue-800",
  pricing: "bg-yellow-100 text-yellow-800",
  program: "bg-gray-100 text-gray-800",
};

const SCOPE_BADGE_COLORS: Record<string, string> = {
  global: "bg-blue-100 text-blue-800",
  china: "bg-red-100 text-red-800",
};

const DIVISION_BADGE_COLORS: Record<string, string> = {
  communications: "bg-purple-100 text-purple-800",
  network: "bg-cyan-100 text-cyan-800",
  general: "bg-gray-100 text-gray-800",
};

interface EFlashDetailSheetProps {
  open: boolean;
  onClose: () => void;
  recordId: number | null;
  onEdit: (id: number) => void;
}

interface TagItem {
  id: number;
  name: string;
  category: string;
}

interface AttachmentItem {
  id: number;
  fileName: string;
}

interface DetailFieldProps {
  label: string;
  children: React.ReactNode;
}

function DetailField({ label, children }: DetailFieldProps) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export function EFlashDetailSheet({ open, onClose, recordId, onEdit }: EFlashDetailSheetProps) {
  const { t } = useTranslation();

  const { data: record, isLoading } = trpc.eflash.getById.useQuery(
    recordId!,
    { enabled: !!recordId && open },
  );

  const tags: TagItem[] = (record as Record<string, unknown> | undefined)?.tags as TagItem[] ?? [];
  const attachments: AttachmentItem[] = (record as Record<string, unknown> | undefined)?.attachments as AttachmentItem[] ?? [];

  const tagsByCategory = tags.reduce<Record<string, TagItem[]>>((acc, tag) => {
    const cat = tag.category || "uncategorized";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(tag);
    return acc;
  }, {});

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("eflash.detail.title")}</SheetTitle>
          <SheetDescription>
            {isLoading
              ? t("common.loading")
              : record
                ? (record as Record<string, unknown>).eflashId as string
                : ""}
          </SheetDescription>
        </SheetHeader>

        {isLoading && (
          <div className="py-8 text-center text-muted-foreground">{t("common.loading")}</div>
        )}

        {record && !isLoading && (
          <div className="px-4 space-y-4">
            <Separator />

            <dl className="grid grid-cols-2 gap-3">
              <DetailField label={t("eflash.fields.eflashId")}>
                <span className="font-mono text-sm">{(record as Record<string, unknown>).eflashId as string}</span>
              </DetailField>

              <DetailField label={t("eflash.fields.type")}>
                <Badge className={`text-[10px] ${TYPE_BADGE_COLORS[(record as Record<string, unknown>).type as string] ?? ""}`}>
                  {t(`eflash.types.${(record as Record<string, unknown>).type as string}`, (record as Record<string, unknown>).type as string)}
                </Badge>
              </DetailField>

              <DetailField label={t("eflash.fields.division")}>
                <Badge className={`text-[10px] ${DIVISION_BADGE_COLORS[(record as Record<string, unknown>).division as string] ?? ""}`}>
                  {t(`eflash.divisions.${(record as Record<string, unknown>).division as string}`, (record as Record<string, unknown>).division as string)}
                </Badge>
              </DetailField>

              <DetailField label={t("eflash.fields.scope")}>
                <Badge className={`text-[10px] ${SCOPE_BADGE_COLORS[(record as Record<string, unknown>).scope as string] ?? ""}`}>
                  {t(`eflash.scopes.${(record as Record<string, unknown>).scope as string}`, (record as Record<string, unknown>).scope as string)}
                </Badge>
              </DetailField>

              <DetailField label={t("eflash.fields.subjectEn")}>
                <span className="text-sm">{((record as Record<string, unknown>).subjectEn as string) ?? "-"}</span>
              </DetailField>

              <DetailField label={t("eflash.fields.subjectCn")}>
                <span className="text-sm">{((record as Record<string, unknown>).subjectCn as string) ?? "-"}</span>
              </DetailField>

              <DetailField label={t("eflash.fields.globalDate")}>
                <span className="text-sm">{((record as Record<string, unknown>).globalDate as string) ?? "-"}</span>
              </DetailField>

              <DetailField label={t("eflash.fields.chinaDate")}>
                <span className="text-sm">{((record as Record<string, unknown>).chinaDate as string) ?? "-"}</span>
              </DetailField>

              <DetailField label={t("eflash.fields.effectiveDate")}>
                <span className="text-sm">{((record as Record<string, unknown>).effectiveDate as string) ?? "-"}</span>
              </DetailField>

              <DetailField label={t("eflash.fields.authorEn")}>
                <span className="text-sm">{((record as Record<string, unknown>).authorEn as string) ?? "-"}</span>
              </DetailField>

              <DetailField label={t("eflash.fields.authorCn")}>
                <span className="text-sm">{((record as Record<string, unknown>).authorCn as string) ?? "-"}</span>
              </DetailField>

              <DetailField label={t("eflash.fields.comments")}>
                <span className="text-sm whitespace-pre-wrap">{((record as Record<string, unknown>).comments as string) ?? "-"}</span>
              </DetailField>
            </dl>

            {tags.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-muted-foreground">{t("eflash.detail.tags")}</h4>
                  {Object.entries(tagsByCategory).map(([category, categoryTags]) => (
                    <div key={category} className="space-y-1">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase">{category}</span>
                      <div className="flex flex-wrap gap-1">
                        {categoryTags.map((tag) => (
                          <Badge key={tag.id} variant="outline" className="text-[10px]">
                            {tag.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {attachments.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-muted-foreground">{t("eflash.detail.attachments")}</h4>
                  <ul className="space-y-1">
                    {attachments.map((att) => (
                      <li key={att.id}>
                        <a
                          href={`/uploads/eflash/${(record as Record<string, unknown>).eflashId as string}/${att.fileName}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          {att.fileName}
                          <Download className="h-3 w-3" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            <SheetFooter>
              <Button
                onClick={() => {
                  if (recordId != null) onEdit(recordId);
                }}
                className="w-full"
              >
                <Pencil className="h-4 w-4 mr-2" />
                {t("eflash.actions.edit")}
              </Button>
            </SheetFooter>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
