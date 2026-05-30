import { useAuth } from "@/_core/hooks/useAuth";
import { useState } from "react";
import { HardDriveUpload, Shield, Database, ClipboardList } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ProductDataImport } from "@/components/import/ProductDataImport";
import { SpecDataImport } from "@/components/import/SpecDataImport";

type TabKey = "product" | "spec";

export default function Import() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [tab, setTab] = useState<TabKey>("product");

  if (user && !user.isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Shield className="w-12 h-12 text-muted-foreground/30" />
        <p className="text-sm font-medium text-foreground">{t('common.noPermission')}</p>
        <p className="text-xs text-muted-foreground">{t('user.superAdminOnly')}</p>
      </div>
    );
  }

  const tabs: { key: TabKey; icon: any; labelKey: string }[] = [
    { key: "product", icon: Database, labelKey: "import.tabProduct" },
    { key: "spec", icon: ClipboardList, labelKey: "import.tabSpec" },
  ];

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <HardDriveUpload className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold text-foreground">{t('import.title')}</h1>
      </div>

      {/* TAB Bar */}
      <div className="flex border-b border-border">
        {tabs.map(({ key, icon: Icon, labelKey }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            <Icon className="w-4 h-4" />
            {t(labelKey)}
          </button>
        ))}
      </div>

      {/* TAB Content */}
      {tab === "product" ? <ProductDataImport /> : <SpecDataImport />}
    </div>
  );
}
