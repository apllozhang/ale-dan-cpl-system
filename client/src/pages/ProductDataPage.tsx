import { useState } from "react";
import { Database, ClipboardList } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ProductDataContent } from "@/components/product/ProductDataContent";
import { SpecDataTab } from "@/components/product/SpecDataTab";

export default function ProductDataPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"product" | "spec">("product");

  const tabs = [
    { key: "product" as const, icon: Database, label: t('data.tabProduct') },
    { key: "spec" as const, icon: ClipboardList, label: t('data.tabSpec') },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* TAB Bar */}
      <div className="flex border-b border-border px-4 bg-background">
        {tabs.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* TAB Content */}
      {tab === "product" ? <ProductDataContent /> : <SpecDataTab />}
    </div>
  );
}
