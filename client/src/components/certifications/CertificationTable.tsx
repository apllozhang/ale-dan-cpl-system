import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/EmptyState";
import { Eye, Pencil, Trash2, ShieldCheck } from "lucide-react";
import { useStaggerIn } from "@/hooks/useStaggerIn";
import { useTableFeatures, type ColumnDef } from "@/hooks/useTableFeatures";
import TablePagination from "@/components/TablePagination";

interface CertificationItem {
  id: number;
  certNo: string;
  certName: string;
  standardType: string | null;
  productCategory: string | null;
  productSeries: string | null;
  issuer: string;
  holder: string;
  expiryDate: string | null;
  status: string;
}

interface Props {
  certType: "product" | "enterprise";
  status?: string;
  standardType?: string;
  productCategory?: string;
  keyword?: string;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onView: (id: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  canManage: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  expired: "bg-gray-100 text-gray-800",
  revoked: "bg-gray-100 text-gray-500 line-through",
  pending: "bg-yellow-100 text-yellow-800",
};

function getExpiryColor(expiryDate: string | null): string {
  if (!expiryDate) return "";
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "text-gray-400";
  if (diffDays <= 30) return "text-red-600 font-semibold";
  if (diffDays <= 90) return "text-orange-500";
  return "";
}

function getColumns(t: (key: string) => string, certType: "product" | "enterprise"): ColumnDef[] {
  const cols: ColumnDef[] = [
    { key: "certNo", label: t("certifications.fields.certNo"), defaultWidth: 140, sortable: true },
    { key: "certName", label: t("certifications.fields.certName"), defaultWidth: 200, sortable: true },
  ];
  if (certType === "product") {
    cols.push(
      { key: "standardType", label: t("certifications.fields.standardType"), defaultWidth: 120, sortable: true },
      { key: "productCategory", label: t("certifications.fields.productCategory"), defaultWidth: 100, sortable: true },
      { key: "productSeries", label: t("certifications.fields.productSeries"), defaultWidth: 120, sortable: true },
    );
  }
  cols.push(
    { key: "issuer", label: t("certifications.fields.issuer"), defaultWidth: 160, sortable: true },
    { key: "holder", label: t("certifications.fields.holder"), defaultWidth: 180, sortable: true },
    { key: "expiryDate", label: t("certifications.fields.expiryDate"), defaultWidth: 100, sortable: true },
    { key: "status", label: t("certifications.fields.status"), defaultWidth: 80, sortable: true },
  );
  return cols;
}

export function CertificationTable({
  certType, status, standardType, productCategory, keyword, page, pageSize,
  onPageChange, onView, onEdit, onDelete, canManage,
}: Props) {
  const { t } = useTranslation();
  const { renderHeader, renderCell, sortData } = useTableFeatures(getColumns(t, certType));

  const { data, isLoading } = trpc.certifications.list.useQuery({
    certType, status, standardType, productCategory, keyword, page, pageSize,
  });

  const items = data?.items ?? [];
  const tbodyRef = useStaggerIn<HTMLTableSectionElement>(items.length > 0 && !isLoading);

  if (isLoading) return <div className="py-8 text-center text-muted-foreground">{t("common.loading")}</div>;
  if (!data || items.length === 0) {
    return (
      <EmptyState icon={ShieldCheck} title={t("common.noData")} />
    );
  }

  const sortedItems = sortData(items);
  const totalPages = Math.ceil(data.total / pageSize);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <colgroup>
            {getColumns(t, certType).map(col => (
              <col key={col.key} style={{ width: `${col.defaultWidth}px`, minWidth: "80px" }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {getColumns(t, certType).map((col, i) => renderHeader(col, i === getColumns(t, certType).length - 1))}
              <th className="px-3 py-2 text-xs font-semibold text-left w-24">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody ref={tbodyRef}>
            {sortedItems.map((cert: CertificationItem) => (
              <tr key={cert.id} className="hover:bg-muted/50 transition-colors">
                {getColumns(t, certType).map((col, i) => {
                  if (col.key === "certNo") return renderCell(col, false, <span className="font-mono text-xs">{cert.certNo}</span>);
                  if (col.key === "certName") return renderCell(col, false, <span className="text-xs">{cert.certName}</span>);
                  if (col.key === "standardType") return renderCell(col, false, <span className="text-xs">{cert.standardType ? t(`certifications.standards.${cert.standardType}`, cert.standardType) : "-"}</span>);
                  if (col.key === "productCategory") return renderCell(col, false, <span className="text-xs">{cert.productCategory ? t(`certifications.categories.${cert.productCategory}`, cert.productCategory) : "-"}</span>);
                  if (col.key === "productSeries") return renderCell(col, false, <span className="text-xs">{cert.productSeries ?? "-"}</span>);
                  if (col.key === "issuer") return renderCell(col, false, <span className="text-xs">{cert.issuer}</span>);
                  if (col.key === "holder") return renderCell(col, false, <span className="text-xs">{cert.holder}</span>);
                  if (col.key === "expiryDate") {
                    const color = getExpiryColor(cert.expiryDate);
                    return renderCell(col, false, <span className={`text-xs ${color}`}>{cert.expiryDate ?? t("certifications.status.active")}</span>);
                  }
                  if (col.key === "status") {
                    return renderCell(col, false, <Badge className={`text-[10px] ${STATUS_COLORS[cert.status] ?? ""}`}>{t(`certifications.status.${cert.status}`, cert.status)}</Badge>);
                  }
                  return renderCell(col, false, <span />);
                })}
                <td className="px-2 py-2">
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => onView(cert.id)} aria-label={t("certifications.actions.view")}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    {canManage && (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => onEdit(cert.id)} aria-label={t("certifications.actions.edit")}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => onDelete(cert.id)} aria-label={t("certifications.actions.delete")}>
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
      <TablePagination
        page={page}
        totalPages={totalPages}
        total={data.total}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={(size) => { onPageChange(1); onPageChange(0); }}
      />
    </div>
  );
}
