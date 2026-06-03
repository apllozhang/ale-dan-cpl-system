import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Megaphone, ArrowRight, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface EFlashRecord {
  id: number;
  eflashId: string;
  type: string;
  subjectCn: string | null;
}

const TYPE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  phase_in: "default",
  phase_out: "destructive",
  service: "secondary",
  pricing: "outline",
  program: "secondary",
};

export function RecentEFlashCard() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();

  const { data: listResult, isLoading } = trpc.eflash.list.useQuery({ pageSize: 5 });
  const { data: stats } = trpc.eflash.getStats.useQuery();

  const records = listResult?.items ?? [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-muted-foreground" />
            {t("eflash.recent.title")}
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

  if (records.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-muted-foreground" />
            {t("eflash.recent.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("eflash.table.empty")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-primary" />
            {t("eflash.recent.title")}
          </CardTitle>
          {stats && (
            <Badge variant="secondary" className="text-xs">
              {t("eflash.recent.count", { count: stats.recentCount })}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          {records.map((record: EFlashRecord) => (
            <div key={record.id} className="flex items-center justify-between text-sm">
              <span className="font-mono truncate max-w-[100px]">{record.eflashId}</span>
              <Badge variant={TYPE_VARIANT[record.type] ?? "secondary"} className="text-xs">
                {t(`eflash.types.${record.type}`)}
              </Badge>
              <span className="text-muted-foreground truncate max-w-[120px]">
                {record.subjectCn ?? "—"}
              </span>
            </div>
          ))}
        </div>
        <Button variant="link" className="p-0 h-auto" onClick={() => setLocation("/eflash")}>
          {t("eflash.recent.viewAll")} <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
}
