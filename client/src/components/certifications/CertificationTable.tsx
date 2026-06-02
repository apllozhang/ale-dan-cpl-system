import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Pencil, Trash2 } from "lucide-react";

interface CertificationItem {
  id: number;
  certNo: string;
  certName: string;
  standardType: string | null;
  issuer: string;
  holder: string;
  expiryDate: string | null;
  status: string;
}

interface Props {
  certType: "product" | "enterprise";
  status?: string;
  standardType?: string;
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

export function CertificationTable({
  certType, status, standardType, keyword, page, pageSize,
  onPageChange, onView, onEdit, onDelete, canManage,
}: Props) {
  const { t } = useTranslation();
  const { data, isLoading } = trpc.certifications.list.useQuery({
    certType, status, standardType, keyword, page, pageSize,
  });

  if (isLoading) return <div className="py-8 text-center text-muted-foreground">{t("common.loading")}</div>;
  if (!data || data.items.length === 0) return <div className="py-8 text-center text-muted-foreground">{t("common.noData")}</div>;

  const totalPages = Math.ceil(data.total / pageSize);

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("certifications.fields.certNo")}</TableHead>
            <TableHead>{t("certifications.fields.certName")}</TableHead>
            {certType === "product" && <TableHead>{t("certifications.fields.standardType")}</TableHead>}
            <TableHead>{t("certifications.fields.issuer")}</TableHead>
            <TableHead>{t("certifications.fields.holder")}</TableHead>
            <TableHead>{t("certifications.fields.expiryDate")}</TableHead>
            <TableHead>{t("certifications.fields.status")}</TableHead>
            <TableHead className="w-24">{t("common.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.items.map((cert: CertificationItem) => (
            <TableRow key={cert.id}>
              <TableCell className="font-mono">{cert.certNo}</TableCell>
              <TableCell>{cert.certName}</TableCell>
              {certType === "product" && <TableCell>{cert.standardType ?? "-"}</TableCell>}
              <TableCell>{cert.issuer}</TableCell>
              <TableCell>{cert.holder}</TableCell>
              <TableCell className={getExpiryColor(cert.expiryDate)}>
                {cert.expiryDate ?? t("certifications.status.active")}
              </TableCell>
              <TableCell>
                <Badge className={STATUS_COLORS[cert.status] ?? ""}>
                  {t(`certifications.status.${cert.status}`, cert.status)}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => onView(cert.id)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  {canManage && (
                    <>
                      <Button variant="ghost" size="icon" onClick={() => onEdit(cert.id)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => onDelete(cert.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4">
          <span className="text-sm text-muted-foreground">
            {t("common.total")}: {data.total}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
              {t("common.previous")}
            </Button>
            <span className="py-1 px-3 text-sm">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
              {t("common.next")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
