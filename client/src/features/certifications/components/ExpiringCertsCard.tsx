import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowRight, Loader2 } from "lucide-react";
import { useLocation } from "wouter";

interface ExpiringCert {
  id: number;
  certNo: string;
  expiryDate: string | null;
}

export function ExpiringCertsCard() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { data: expiring, isLoading } = trpc.certifications.expiring.useQuery({ days: 90 });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            {t("certifications.expiring.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!expiring || expiring.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-green-500" />
            {t("certifications.expiring.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("certifications.expiring.noExpiring")}</p>
        </CardContent>
      </Card>
    );
  }

  const urgent = expiring.filter((c: ExpiringCert) => {
    if (!c.expiryDate) return false;
    const days = Math.ceil((new Date(c.expiryDate).getTime() - Date.now()) / 86400000);
    return days <= 30;
  }).length;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <AlertTriangle className={`h-4 w-4 ${urgent > 0 ? "text-red-500" : "text-orange-500"}`} />
          {t("certifications.expiring.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold">{expiring.length}</span>
          <span className="text-sm text-muted-foreground">{t("certifications.expiring.count")}</span>
        </div>
        <div className="space-y-1">
          {expiring.slice(0, 5).map((cert: ExpiringCert) => (
            <div key={cert.id} className="flex items-center justify-between text-sm">
              <span className="font-mono truncate max-w-[120px]">{cert.certNo}</span>
              <Badge variant={cert.expiryDate && new Date(cert.expiryDate) < new Date() ? "destructive" : "secondary"}>
                {formatDate(cert.expiryDate)}
              </Badge>
            </div>
          ))}
        </div>
        <Button variant="link" className="p-0 h-auto" onClick={() => setLocation("/certifications")}>
          {t("certifications.expiring.viewAll")} <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
}
