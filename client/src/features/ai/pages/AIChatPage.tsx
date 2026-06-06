import { useTranslation } from "react-i18next";
import { useAuth } from "@/_core/hooks/useAuth";
import { hasPermission, PERMISSIONS } from "@shared/const";
import { trpc } from "@/lib/trpc";
import { AIChatBox } from "@/components/AIChatBox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldAlert, Bot } from "lucide-react";
import { useState } from "react";

import { useAIChat, type UploadedFile } from "../hooks/useAIChat";
import { ConversationSidebar } from "../components/ConversationSidebar";
import { ModelSelector } from "../components/ModelSelector";
import { FileUploadZone } from "../components/FileUploadZone";
import { SearchResultsCard } from "../components/SearchResultsCard";

export default function AIChatPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  // Permission check
  const canUseAI = user ? hasPermission(user, PERMISSIONS.USE_AI_AGENT) : false;

  if (!canUseAI) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
        <ShieldAlert className="size-12 opacity-30" />
        <p className="text-sm">{t("common.noPermission")}</p>
      </div>
    );
  }

  return <AIChatContent />;
}

function AIChatContent() {
  const { t } = useTranslation();

  const {
    conversations,
    conversationsLoading,
    activeConversationId,
    setActiveConversationId,
    messages,
    latestSearchResults,
    selectedMode,
    setSelectedMode,
    isSending,
    createConversation,
    deleteConversation,
    sendMessage,
  } = useAIChat();

  // Models query (read-only list for selector)
  const modelsQuery = trpc.ai.models.list.useQuery(undefined, {
    select: (configs) =>
      configs.map((c) => ({
        id: c.id,
        name: c.name,
        modelName: c.modelName,
        isDefault: c.isDefault,
      })),
  });

  // Selected model for conversation
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);

  // Files for local mode
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  const handleSendMessage = (content: string) => {
    sendMessage(content, selectedMode === "local" && uploadedFiles.length > 0 ? uploadedFiles : undefined);
    setUploadedFiles([]);
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left Sidebar */}
      <ConversationSidebar
        conversations={conversations}
        activeId={activeConversationId}
        onSelect={setActiveConversationId}
        onCreate={createConversation}
        onDelete={deleteConversation}
      />

      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <div className="flex items-center gap-3">
            <Tabs
              value={selectedMode}
              onValueChange={(val) => setSelectedMode(val as "local" | "expert")}
            >
              <TabsList>
                <TabsTrigger value="local">{t("ai.localMode")}</TabsTrigger>
                <TabsTrigger value="expert">{t("ai.expertMode")}</TabsTrigger>
              </TabsList>
            </Tabs>

            <ModelSelector
              models={modelsQuery.data ?? []}
              selectedId={selectedModelId}
              onSelect={setSelectedModelId}
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Bot className="size-3.5" />
            {selectedMode === "local" ? t("ai.localMode") : t("ai.expertMode")}
          </div>
        </div>

        {/* File Upload (local mode) */}
        {selectedMode === "local" && (
          <div className="border-b border-border px-4 py-2">
            <FileUploadZone files={uploadedFiles} onFilesChange={setUploadedFiles} />
          </div>
        )}

        {/* Chat Area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <AIChatBox
              messages={messages}
              onSendMessage={handleSendMessage}
              isLoading={isSending}
              height="100%"
              emptyStateMessage={t("ai.newConversation")}
            />
          </div>

          {/* Search Results (expert mode) */}
          {selectedMode === "expert" && latestSearchResults.length > 0 && (
            <div className="border-t border-border px-4 py-2">
              <SearchResultsCard results={latestSearchResults} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
