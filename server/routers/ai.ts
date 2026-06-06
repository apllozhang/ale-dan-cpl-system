import { router, permissionProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { decryptConfigKey, maskConfigKey, decryptSearchKey, maskSearchKey } from "../db/ai";
import { invokeLLM, type ProviderConfig } from "../_core/llm";
import { webSearch, type SearchConfig } from "../_core/search";
import { extractText } from "../_core/file-extract";
import { PERMISSIONS } from "@shared/const";
import fs from "fs/promises";
import path from "path";
import os from "os";

// ── Permission-scoped procedures ──
const aiConfigProcedure = permissionProcedure(PERMISSIONS.MANAGE_AI_CONFIG);
const aiUserProcedure = permissionProcedure(PERMISSIONS.USE_AI_AGENT);

// ── Shared Zod schemas ──
const providerEnum = z.enum(["openai_compatible", "google_gemini"]);
const searchProviderEnum = z.enum(["serper", "serpapi", "google_custom", "bing", "tavily", "custom"]);
const modeEnum = z.enum(["local", "expert"]);

const ALLOWED_FILE_TYPES = [
  "pdf", "docx", "doc", "xlsx", "xls", "txt", "csv",
];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export const aiRouter = router({
  // ══════════════════════════════════════════
  //  Provider Config Models (admin)
  // ══════════════════════════════════════════
  models: router({
    list: aiConfigProcedure.query(async () => {
      try {
        const configs = await db.listProviderConfigs();
        return configs.map((c) => ({
          ...c,
          apiKey: maskConfigKey(c),
        }));
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to list provider configs", cause: error });
      }
    }),

    create: aiConfigProcedure
      .input(z.object({
        name: z.string().min(1).max(100),
        provider: providerEnum,
        apiBaseUrl: z.string().url(),
        apiKey: z.string().min(1),
        modelName: z.string().min(1).max(100),
        maxTokens: z.number().int().optional(),
        temperature: z.string().optional(),
        isDefault: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const id = await db.createProviderConfig({
            ...input,
            createdBy: ctx.user.id,
          });
          return { id };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create provider config", cause: error });
        }
      }),

    update: aiConfigProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(100).optional(),
        provider: providerEnum.optional(),
        apiBaseUrl: z.string().url().optional(),
        apiKey: z.string().min(1).optional(),
        modelName: z.string().min(1).max(100).optional(),
        maxTokens: z.number().int().optional(),
        temperature: z.string().optional(),
        isDefault: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          const { id, ...data } = input;
          const existing = await db.getProviderConfig(id);
          if (!existing) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Provider config not found" });
          }
          await db.updateProviderConfig(id, data);
          return { success: true };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to update provider config", cause: error });
        }
      }),

    delete: aiConfigProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        try {
          const existing = await db.getProviderConfig(input.id);
          if (!existing) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Provider config not found" });
          }
          await db.deleteProviderConfig(input.id);
          return { success: true };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to delete provider config", cause: error });
        }
      }),

    test: aiConfigProcedure
      .input(z.object({ id: z.number().optional() }).optional())
      .mutation(async ({ input }) => {
        try {
          let config;
          if (input?.id) {
            config = await db.getProviderConfig(input.id);
            if (!config) {
              throw new TRPCError({ code: "NOT_FOUND", message: "Provider config not found" });
            }
          } else {
            config = await db.getDefaultProviderConfig();
            if (!config) {
              throw new TRPCError({ code: "NOT_FOUND", message: "No default provider config found" });
            }
          }

          const apiKey = decryptConfigKey(config);
          const providerConfig: ProviderConfig = {
            provider: config.provider,
            apiBaseUrl: config.apiBaseUrl,
            apiKey,
            modelName: config.modelName,
            maxTokens: config.maxTokens ?? undefined,
            temperature: config.temperature ? parseFloat(config.temperature) : undefined,
          };

          const start = Date.now();
          const result = await invokeLLM(
            {
              messages: [{ role: "user", content: "Hi, reply with 'OK' only." }],
            },
            providerConfig,
          );
          const latencyMs = Date.now() - start;

          const content = result.choices?.[0]?.message?.content ?? "";
          return {
            success: true,
            model: config.modelName,
            latencyMs,
            preview: typeof content === "string" ? content.slice(0, 200) : JSON.stringify(content).slice(0, 200),
          };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          return {
            success: false,
            model: "unknown",
            latencyMs: 0,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }),
  }),

  // ══════════════════════════════════════════
  //  Search Configs (admin)
  // ══════════════════════════════════════════
  searchConfigs: router({
    list: aiConfigProcedure.query(async () => {
      try {
        const configs = await db.listSearchConfigs();
        return configs.map((c) => ({
          ...c,
          apiKey: maskSearchKey(c),
        }));
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to list search configs", cause: error });
      }
    }),

    create: aiConfigProcedure
      .input(z.object({
        name: z.string().min(1).max(100),
        provider: searchProviderEnum,
        apiBaseUrl: z.string().url(),
        apiKey: z.string().min(1),
        extraParams: z.record(z.string(), z.string()).optional(),
        isDefault: z.boolean().optional(),
        dailyLimit: z.number().int().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const id = await db.createSearchConfig({
            ...input,
            createdBy: ctx.user.id,
          } as Parameters<typeof db.createSearchConfig>[0]);
          return { id };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create search config", cause: error });
        }
      }),

    update: aiConfigProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(100).optional(),
        provider: searchProviderEnum.optional(),
        apiBaseUrl: z.string().url().optional(),
        apiKey: z.string().min(1).optional(),
        extraParams: z.record(z.string(), z.string()).optional(),
        isDefault: z.boolean().optional(),
        dailyLimit: z.number().int().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          const { id, ...data } = input;
          const existing = await db.getSearchConfig(id);
          if (!existing) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Search config not found" });
          }
          await db.updateSearchConfig(id, data as Parameters<typeof db.updateSearchConfig>[1]);
          return { success: true };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to update search config", cause: error });
        }
      }),

    delete: aiConfigProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        try {
          const existing = await db.getSearchConfig(input.id);
          if (!existing) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Search config not found" });
          }
          await db.deleteSearchConfig(input.id);
          return { success: true };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to delete search config", cause: error });
        }
      }),

    test: aiConfigProcedure
      .input(z.object({ id: z.number().optional() }).optional())
      .mutation(async ({ input }) => {
        try {
          let config;
          if (input?.id) {
            config = await db.getSearchConfig(input.id);
            if (!config) {
              throw new TRPCError({ code: "NOT_FOUND", message: "Search config not found" });
            }
          } else {
            config = await db.getDefaultSearchConfig();
            if (!config) {
              throw new TRPCError({ code: "NOT_FOUND", message: "No default search config found" });
            }
          }

          const apiKey = decryptSearchKey(config);
          const searchConfig: SearchConfig = {
            provider: config.provider,
            apiBaseUrl: config.apiBaseUrl,
            apiKey,
            extraParams: config.extraParams ?? undefined,
          };

          const start = Date.now();
          const results = await webSearch("test query", searchConfig, 3);
          const latencyMs = Date.now() - start;

          return {
            success: true,
            resultCount: results.length,
            latencyMs,
            preview: results.slice(0, 3).map((r) => r.title),
          };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          return {
            success: false,
            resultCount: 0,
            latencyMs: 0,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }),
  }),

  // ══════════════════════════════════════════
  //  Knowledge Bases (admin)
  // ══════════════════════════════════════════
  knowledgeBases: router({
    list: aiConfigProcedure.query(async () => {
      try {
        return await db.listKnowledgeBases();
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to list knowledge bases", cause: error });
      }
    }),

    create: aiConfigProcedure
      .input(z.object({
        name: z.string().min(1).max(200),
        description: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const id = await db.createKnowledgeBase({
            ...input,
            createdBy: ctx.user.id,
          });
          return { id };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create knowledge base", cause: error });
        }
      }),

    delete: aiConfigProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        try {
          const existing = await db.getKnowledgeBase(input.id);
          if (!existing) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Knowledge base not found" });
          }
          await db.deleteKnowledgeBase(input.id);
          return { success: true };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to delete knowledge base", cause: error });
        }
      }),

    uploadDoc: aiConfigProcedure
      .input(z.object({
        knowledgeBaseId: z.number(),
        fileName: z.string().min(1).max(500),
        fileType: z.string().min(1),
        fileSize: z.number().int().max(MAX_FILE_SIZE),
        data: z.string().max(67_108_864), // ~67MB base64
      }))
      .mutation(async ({ input }) => {
        try {
          // Validate file type
          const ext = input.fileType.toLowerCase().replace(".", "");
          if (!ALLOWED_FILE_TYPES.includes(ext)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Unsupported file type: ${ext}. Allowed: ${ALLOWED_FILE_TYPES.join(", ")}`,
            });
          }

          // Verify knowledge base exists
          const kb = await db.getKnowledgeBase(input.knowledgeBaseId);
          if (!kb) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Knowledge base not found" });
          }

          // Create doc record in processing state
          const docId = await db.createKnowledgeDoc({
            knowledgeBaseId: input.knowledgeBaseId,
            fileName: input.fileName,
            fileType: input.fileType,
            fileSize: input.fileSize,
            status: "processing",
          });

          // Write to temp file, extract text, cleanup
          const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cpl-ai-"));
          const tmpFile = path.join(tmpDir, input.fileName);

          try {
            const buffer = Buffer.from(input.data, "base64");
            await fs.writeFile(tmpFile, buffer);

            const extractedText = await extractText(tmpFile, input.fileType);

            await db.updateKnowledgeDoc(docId, {
              extractedText,
              status: "ready",
            });
          } catch (extractError) {
            await db.updateKnowledgeDoc(docId, {
              status: "failed",
            });
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: `File extraction failed: ${extractError instanceof Error ? extractError.message : String(extractError)}`,
            });
          } finally {
            // Cleanup temp files
            await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
          }

          return { id: docId, success: true };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to upload document", cause: error });
        }
      }),

    listDocs: aiConfigProcedure
      .input(z.object({ knowledgeBaseId: z.number() }))
      .query(async ({ input }) => {
        try {
          const docs = await db.listKnowledgeDocs(input.knowledgeBaseId);
          // Exclude extractedText from listing (potentially very large)
          return docs.map(({ extractedText, ...doc }) => doc);
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to list documents", cause: error });
        }
      }),
  }),

  // ══════════════════════════════════════════
  //  Conversations (all logged-in users with USE_AI_AGENT)
  // ══════════════════════════════════════════
  conversations: router({
    list: aiUserProcedure.query(async ({ ctx }) => {
      try {
        return await db.listConversationsByUserId(ctx.user.id);
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to list conversations", cause: error });
      }
    }),

    get: aiUserProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        try {
          const conv = await db.getConversation(input.id, ctx.user.id);
          if (!conv) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" });
          }
          const messages = await db.listMessages(input.id);
          return { ...conv, messages };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to get conversation", cause: error });
        }
      }),

    create: aiUserProcedure
      .input(z.object({
        mode: modeEnum,
        providerConfigId: z.number().optional(),
        searchConfigId: z.number().optional(),
        knowledgeBaseId: z.number().optional(),
        systemPrompt: z.string().max(2000).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const id = await db.createConversation({
            userId: ctx.user.id,
            mode: input.mode,
            providerConfigId: input.providerConfigId ?? null,
            searchConfigId: input.searchConfigId ?? null,
            knowledgeBaseId: input.knowledgeBaseId ?? null,
            systemPrompt: input.systemPrompt ?? null,
          });
          return { id };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create conversation", cause: error });
        }
      }),

    delete: aiUserProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        try {
          const conv = await db.getConversation(input.id, ctx.user.id);
          if (!conv) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" });
          }
          await db.deleteConversation(input.id);
          return { success: true };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to delete conversation", cause: error });
        }
      }),
  }),

  // ══════════════════════════════════════════
  //  Chat (all logged-in users with USE_AI_AGENT)
  // ══════════════════════════════════════════
  chat: router({
    send: aiUserProcedure
      .input(z.object({
        conversationId: z.number(),
        message: z.string().min(1).max(10000),
        files: z.array(z.object({
          name: z.string(),
          size: z.number(),
          type: z.string(),
          extractedText: z.string().optional(),
        })).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          // 1. Verify conversation ownership
          const conv = await db.getConversation(input.conversationId, ctx.user.id);
          if (!conv) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" });
          }

          // 2. Load provider config (specific or default)
          let providerConfigRow;
          if (conv.providerConfigId) {
            providerConfigRow = await db.getProviderConfig(conv.providerConfigId);
          }
          if (!providerConfigRow) {
            providerConfigRow = await db.getDefaultProviderConfig();
          }
          if (!providerConfigRow) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No AI provider configured" });
          }

          // 3. Decrypt API Key
          const apiKey = decryptConfigKey(providerConfigRow);
          const providerConfig: ProviderConfig = {
            provider: providerConfigRow.provider,
            apiBaseUrl: providerConfigRow.apiBaseUrl,
            apiKey,
            modelName: providerConfigRow.modelName,
            maxTokens: providerConfigRow.maxTokens ?? undefined,
            temperature: providerConfigRow.temperature ? parseFloat(providerConfigRow.temperature) : undefined,
          };

          // 4. Load recent message history (last 20 messages)
          const recentMessages = await db.getRecentMessages(input.conversationId, 20);

          // 5. Build context for local mode
          let contextParts: string[] = [];
          let searchResults: Array<{ title: string; url: string; snippet: string; date?: string }> = [];

          if (conv.mode === "local") {
            // Inject file text
            if (input.files?.length) {
              const fileTexts = input.files
                .filter((f) => f.extractedText)
                .map((f) => `[File: ${f.name}]\n${f.extractedText}`);
              if (fileTexts.length > 0) {
                contextParts.push("=== Attached Files ===\n" + fileTexts.join("\n\n"));
              }
            }

            // Inject knowledge base results
            if (conv.knowledgeBaseId) {
              const kbText = await db.searchKnowledgeBase(conv.knowledgeBaseId, input.message);
              if (kbText) {
                contextParts.push("=== Knowledge Base ===\n" + kbText);
              }
            }

            // Web search if search config available
            if (conv.searchConfigId) {
              const searchConfigRow = await db.getSearchConfig(conv.searchConfigId);
              if (searchConfigRow) {
                try {
                  const searchApiKey = decryptSearchKey(searchConfigRow);
                  const searchConfig: SearchConfig = {
                    provider: searchConfigRow.provider,
                    apiBaseUrl: searchConfigRow.apiBaseUrl,
                    apiKey: searchApiKey,
                    extraParams: searchConfigRow.extraParams ?? undefined,
                  };
                  searchResults = await webSearch(input.message, searchConfig, 5);
                  if (searchResults.length > 0) {
                    const searchContext = searchResults
                      .map((r) => `- ${r.title}: ${r.snippet}`)
                      .join("\n");
                    contextParts.push("=== Web Search Results ===\n" + searchContext);
                  }
                } catch {
                  // Search failure should not block chat
                }
              }
            }
          }

          // 6. Build LLM messages
          const systemPrompt =
            conv.systemPrompt ||
            process.env.AI_DEFAULT_SYSTEM_PROMPT ||
            "You are a helpful AI assistant. Answer questions accurately and concisely.";

          const llmMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
            { role: "system", content: systemPrompt },
          ];

          // Inject context as system message for local mode
          if (contextParts.length > 0) {
            llmMessages.push({
              role: "system",
              content: "Use the following context to answer the user's question:\n\n" + contextParts.join("\n\n"),
            });
          }

          // Add history
          for (const msg of recentMessages) {
            if (msg.role === "user" || msg.role === "assistant") {
              llmMessages.push({ role: msg.role, content: msg.content });
            }
          }

          // Add user message
          llmMessages.push({ role: "user", content: input.message });

          // 7. Store user message
          await db.createMessage({
            conversationId: input.conversationId,
            role: "user",
            content: input.message,
            mode: conv.mode,
            attachedFiles: input.files?.length ? input.files.map((f) => ({
              name: f.name,
              size: f.size,
              type: f.type,
            })) : null,
          });

          // 8. Call LLM
          const result = await invokeLLM({ messages: llmMessages }, providerConfig);
          const assistantContent = result.choices?.[0]?.message?.content;
          const content = typeof assistantContent === "string"
            ? assistantContent
            : JSON.stringify(assistantContent) ?? "";

          // 9. Store assistant message
          await db.createMessage({
            conversationId: input.conversationId,
            role: "assistant",
            content,
            mode: conv.mode,
            searchResults: searchResults.length > 0 ? searchResults : null,
          });

          // 10. Auto-generate title for new conversations
          if (!conv.title) {
            const title = input.message.slice(0, 50).replace(/\n/g, " ");
            await db.updateConversationTitle(input.conversationId, title);
          }

          // 11. Return response
          return {
            content,
            searchResults: searchResults.length > 0 ? searchResults : undefined,
            attachedFiles: input.files?.map((f) => ({ name: f.name, size: f.size, type: f.type })),
          };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to process chat message", cause: error });
        }
      }),
  }),
});
