import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";
import { APP_VERSION } from "@shared/const";

interface AboutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs p-0 overflow-hidden" showCloseButton={false}>
        <div className="bg-primary/5 px-6 pt-8 pb-5 text-center">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <span className="text-lg font-bold text-primary">DAN</span>
          </div>
          <h2 className="text-base font-semibold">{t("about.description")}</h2>
        </div>
        <div className="px-6 py-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("about.version")}</span>
            <span className="font-mono font-medium">v{APP_VERSION}</span>
          </div>
        </div>
        <div className="border-t px-6 py-3">
          <p className="text-[11px] text-center text-muted-foreground/60">
            {t("about.copyright")}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
