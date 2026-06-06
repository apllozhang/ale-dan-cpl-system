import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Plus, MessageSquare, Trash2 } from "lucide-react";
import { useState } from "react";
import type { ConversationViewItem } from "../hooks/useAIChat";

type Props = {
  conversations: ConversationViewItem[];
  activeId: number | null;
  onSelect: (id: number) => void;
  onCreate: () => void;
  onDelete: (id: number) => void;
};

export function ConversationSidebar({ conversations, activeId, onSelect, onCreate, onDelete }: Props) {
  const { t } = useTranslation();
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  return (
    <div className="flex h-full w-64 flex-col border-r border-border bg-muted/30">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-3">
        <span className="text-sm font-medium">{t("ai.newConversation")}</span>
        <Button variant="ghost" size="icon" className="size-7" onClick={onCreate}>
          <Plus className="size-4" />
        </Button>
      </div>

      {/* Conversation List */}
      <ScrollArea className="flex-1">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-6 text-muted-foreground">
            <MessageSquare className="size-8 opacity-30" />
            <p className="text-xs">{t("ai.noConversations")}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5 p-2">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={cn(
                  "group relative flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  activeId === conv.id
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground hover:bg-muted/50",
                )}
                onClick={() => onSelect(conv.id)}
                onMouseEnter={() => setHoveredId(conv.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <MessageSquare className="size-3.5 shrink-0 opacity-50" />
                <span className="flex-1 truncate">
                  {conv.title || t("ai.untitled")}
                </span>
                {hoveredId === conv.id && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(conv.id);
                    }}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
