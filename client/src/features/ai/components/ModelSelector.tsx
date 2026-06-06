import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ModelItem = {
  id: number;
  name: string;
  modelName: string;
  isDefault: boolean;
};

type Props = {
  models: ModelItem[];
  selectedId: number | null;
  onSelect: (id: number) => void;
};

export function ModelSelector({ models, selectedId, onSelect }: Props) {
  const { t } = useTranslation();

  if (models.length === 0) {
    return (
      <span className="text-sm text-muted-foreground">
        {t("ai.noModelsConfigured")}
      </span>
    );
  }

  return (
    <Select
      value={selectedId != null ? String(selectedId) : undefined}
      onValueChange={(val) => onSelect(Number(val))}
    >
      <SelectTrigger className="w-[200px]" size="sm">
        <SelectValue placeholder={t("ai.selectModel")} />
      </SelectTrigger>
      <SelectContent>
        {models.map((model) => (
          <SelectItem key={model.id} value={String(model.id)}>
            {model.isDefault ? "⭐ " : ""}
            {model.name}
            <span className="ml-1 text-muted-foreground">({model.modelName})</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
