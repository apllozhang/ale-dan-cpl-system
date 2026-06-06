import { useState, useCallback, useRef, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type { Message } from "@/components/AIChatBox";

export type ConversationViewItem = {
  id: number;
  title: string | null;
  mode: string;
  updatedAt: string;
};

export type UploadedFile = {
  name: string;
  size: number;
  type: string;
  extractedText?: string;
};

export type UseAIChatReturn = {
  // conversations
  conversations: ConversationViewItem[];
  conversationsLoading: boolean;
  activeConversationId: number | null;
  setActiveConversationId: (id: number | null) => void;

  // messages
  messages: Message[];
  latestSearchResults: Array<{ title: string; url: string; snippet: string; date?: string }>;

  // mode
  selectedMode: "local" | "expert";
  setSelectedMode: (mode: "local" | "expert") => void;

  // state
  isLoading: boolean;
  isSending: boolean;

  // actions
  createConversation: () => Promise<number | null>;
  deleteConversation: (id: number) => Promise<void>;
  sendMessage: (content: string, files?: UploadedFile[]) => Promise<void>;
};

export function useAIChat(): UseAIChatReturn {
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  // ── State ──
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [selectedMode, setSelectedMode] = useState<"local" | "expert">("local");
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [latestSearchResults, setLatestSearchResults] = useState<
    Array<{ title: string; url: string; snippet: string; date?: string }>
  >([]);
  const optimisticRef = useRef(false);

  // ── Queries ──
  const conversationsQuery = trpc.ai.conversations.list.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const conversationDetailQuery = trpc.ai.conversations.get.useQuery(
    { id: activeConversationId! },
    { enabled: activeConversationId !== null },
  );

  // Map raw conversation data to view model
  const conversations: ConversationViewItem[] = useMemo(
    () =>
      (conversationsQuery.data ?? []).map((c) => ({
        id: c.id,
        title: c.title,
        mode: c.mode,
        updatedAt: c.updatedAt instanceof Date ? c.updatedAt.toISOString() : String(c.updatedAt),
      })),
    [conversationsQuery.data],
  );

  // ── Mutations ──
  const createMutation = trpc.ai.conversations.create.useMutation({
    onSuccess: () => {
      utils.ai.conversations.list.invalidate();
    },
  });

  const deleteMutation = trpc.ai.conversations.delete.useMutation({
    onSuccess: () => {
      utils.ai.conversations.list.invalidate();
    },
  });

  const sendMutation = trpc.ai.chat.send.useMutation({
    onSuccess: () => {
      if (activeConversationId) {
        utils.ai.conversations.get.invalidate({ id: activeConversationId });
        utils.ai.conversations.list.invalidate();
      }
    },
  });

  // ── Derived messages ──
  const messages: Message[] =
    activeConversationId && conversationDetailQuery.data && !optimisticRef.current
      ? conversationDetailQuery.data.messages.map((m) => ({
          role: m.role as Message["role"],
          content: m.content,
        }))
      : localMessages;

  // ── Actions ──
  const createConversation = useCallback(async (): Promise<number | null> => {
    try {
      const result = await createMutation.mutateAsync({ mode: selectedMode });
      setActiveConversationId(result.id);
      setLocalMessages([]);
      setLatestSearchResults([]);
      return result.id;
    } catch {
      toast.error(t("common.operationFailed"));
      return null;
    }
  }, [createMutation, selectedMode, t]);

  const deleteConversation = useCallback(
    async (id: number) => {
      try {
        await deleteMutation.mutateAsync({ id });
        if (activeConversationId === id) {
          setActiveConversationId(null);
          setLocalMessages([]);
          setLatestSearchResults([]);
        }
      } catch {
        toast.error(t("common.operationFailed"));
      }
    },
    [deleteMutation, activeConversationId],
  );

  const sendMessage = useCallback(
    async (content: string, files?: UploadedFile[]) => {
      let convId = activeConversationId;

      // 1. Create conversation if needed
      if (!convId) {
        try {
          const result = await createMutation.mutateAsync({ mode: selectedMode });
          convId = result.id;
          setActiveConversationId(convId);
        } catch {
          toast.error(t("ai.sendMessageFailed"));
          return;
        }
      }

      // 2. Optimistic update: add user message locally
      const userMessage: Message = { role: "user", content };
      optimisticRef.current = true;
      setLocalMessages((prev) => [...prev, userMessage]);

      // 3. Send to server
      try {
        const response = await sendMutation.mutateAsync({
          conversationId: convId,
          message: content,
          files: files?.length ? files : undefined,
        });

        // 4. Update with real messages from server after refetch
        optimisticRef.current = false;
        setLocalMessages([]);

        // 5. Update search results
        if (response.searchResults) {
          setLatestSearchResults(response.searchResults);
        } else {
          setLatestSearchResults([]);
        }
      } catch {
        // Rollback optimistic update
        optimisticRef.current = false;
        setLocalMessages((prev) => prev.slice(0, -1));
        toast.error(t("ai.sendMessageFailed"));
      }
    },
    [activeConversationId, selectedMode, createMutation, sendMutation, t],
  );

  return {
    conversations,
    conversationsLoading: conversationsQuery.isLoading,
    activeConversationId,
    setActiveConversationId,
    messages,
    latestSearchResults,
    selectedMode,
    setSelectedMode,
    isLoading: conversationsQuery.isLoading,
    isSending: sendMutation.isPending,
    createConversation,
    deleteConversation,
    sendMessage,
  };
}
