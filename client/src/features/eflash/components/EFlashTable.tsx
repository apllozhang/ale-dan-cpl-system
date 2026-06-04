import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/EmptyState";
import { Eye, Pencil, Trash2, Zap } from "lucide-react";
import { useStaggerIn } from "@/hooks/useStaggerIn";
import { useTableFeatures, type ColumnDef } from "@/hooks/useTableFeatures";
import { useMemo } from "react";

type EFlashItem = {
  id: number;
  eflashId: string;
  type: "phase_in" | "phase_out" | "service" | "pricing" | "program";
  division: "communications" | "network" | "general";
  scope: "global" | "china";
  subjectCn: string | null;
  subjectEn: string | null;
  effectiveDate: Date | null;
  globalDate: Date | null;
  chinaDate: Date | null;
  createdAt: Date;
}

interface EFlashTableProps {
  items: EFlashItem[];
  canManage: boolean;
  onViewDetail: (id: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
}

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

function formatDate(dateVal: Date | string | null): string {
  if (!dateVal) return "-";
  const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
  if (isNaN(d.getTime())) return "-";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getColumns(t: (key: string) => string): ColumnDef[] {
  return [
    { key: "eflashId", label: t("eflash.fields.eflashId"), defaultWidth: 140, sortable: true },
    { key: "type", label: t("eflash.fields.type"), defaultWidth: 100, sortable: true },
    { key: "division", label: t("eflash.fields.division"), defaultWidth: 100, sortable: true },
    { key: "scope", label: t("eflash.fields.scope"), defaultWidth: 80, sortable: true },
    { key: "subjectCn", label: t("eflash.fields.subjectCn"), defaultWidth: 250 },
    { key: "effectiveDate", label: t("eflash.fields.effectiveDate"), defaultWidth: 120, sortable: true },
  ];
}

export function EFlashTable({
  items,
  canManage,
  onViewDetail,
  onEdit,
  onDelete,
}: EFlashTableProps) {
  const { t } = useTranslation();
  const columns = useMemo(() => getColumns(t), [t]);
  const { renderHeader, renderCell, sortData } = useTableFeatures(columns);

  const tbodyRef = useStaggerIn<HTMLTableSectionElement>(items.length > 0);

  if (items.length === 0) {
    return <EmptyState icon={Zap} title={t("common.noData")} />;
  }

  const sortedItems = sortData(items);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <colgroup>
          {columns.map((col) => (
            <col key={col.key} style={{ width: `${col.defaultWidth}px`, minWidth: "80px" }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((col, i) => renderHeader(col, i === columns.length - 1))}
            <th className="px-3 py-2 text-xs font-semibold text-left w-24">{t("common.actions")}</th>
          </tr>
        </thead>
        <tbody ref={tbodyRef}>
          {sortedItems.map((item: EFlashItem) => (
            <tr key={item.id} className="hover:bg-muted/50 transition-colors">
              {columns.map((col) => {
                if (col.key === "eflashId") {
                  return renderCell(col, false, <span className="font-mono text-xs">{item.eflashId}</span>);
                }
                if (col.key === "type") {
                  return renderCell(
                    col,
                    false,
                    <Badge className={`text-[10px] ${TYPE_BADGE_COLORS[item.type] ?? ""}`}>
                      {t(`eflash.types.${item.type}`, item.type)}
                    </Badge>,
                  );
                }
                if (col.key === "division") {
                  return renderCell(
                    col,
                    false,
                    <span className="text-xs">{t(`eflash.divisions.${item.division}`, item.division)}</span>,
                  );
                }
                if (col.key === "scope") {
                  return renderCell(
                    col,
                    false,
                    <Badge className={`text-[10px] ${SCOPE_BADGE_COLORS[item.scope] ?? ""}`}>
                      {t(`eflash.scopes.${item.scope}`, item.scope)}
                    </Badge>,
                  );
                }
                if (col.key === "subjectCn") {
                  return renderCell(
                    col,
                    false,
                    <span className="text-xs line-clamp-1">{item.subjectCn ?? item.subjectEn ?? "-"}</span>,
                  );
                }
                if (col.key === "effectiveDate") {
                  return renderCell(col, false, <span className="text-xs">{formatDate(item.effectiveDate)}</span>);
                }
                return renderCell(col, false, <span />);
              })}
              <td className="px-2 py-2">
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => onViewDetail(item.id)} aria-label={t("eflash.actions.view")}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  {canManage && (
                    <>
                      <Button variant="ghost" size="icon" onClick={() => onEdit(item.id)} aria-label={t("eflash.actions.edit")}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => onDelete(item.id)} aria-label={t("eflash.actions.delete")}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
