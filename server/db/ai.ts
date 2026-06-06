import { eq, and, desc } from "drizzle-orm";
import {
  aiProviderConfigs,
  aiSearchConfigs,
  aiConversations,
  aiMessages,
  type AiProviderConfig,
  type InsertAiProviderConfig,
  type AiSearchConfig,
  type InsertAiSearchConfig,
  type AiConversation,
  type InsertAiConversation,
  type AiMessage,
  type InsertAiMessage,
} from "../../drizzle/schema";
import { requireDb } from "./index";
import { encrypt, decrypt, maskApiKey } from "../_core/crypto";

// ==================== Provider Config ====================

export async function listProviderConfigs(): Promise<AiProviderConfig[]> {
  const db = await requireDb();
  return db.select().from(aiProviderConfigs).orderBy(desc(aiProviderConfigs.createdAt));
}

export async function getProviderConfig(id: number): Promise<AiProviderConfig | undefined> {
  const db = await requireDb();
  const rows = await db.select().from(aiProviderConfigs).where(eq(aiProviderConfigs.id, id)).limit(1);
  return rows[0];
}

export async function createProviderConfig(data: InsertAiProviderConfig): Promise<number> {
  const db = await requireDb();

  // If setting as default, clear other defaults first
  if (data.isDefault) {
    await db.update(aiProviderConfigs).set({ isDefault: false }).where(eq(aiProviderConfigs.isDefault, true));
  }

  const result = await db.insert(aiProviderConfigs).values({
    ...data,
    apiKey: encrypt(data.apiKey),
  });
  return Number((result[0] as { insertId: number }).insertId);
}

export async function updateProviderConfig(id: number, data: Partial<InsertAiProviderConfig>): Promise<void> {
  const db = await requireDb();

  // If setting as default, clear other defaults first
  if (data.isDefault) {
    await db.update(aiProviderConfigs).set({ isDefault: false }).where(eq(aiProviderConfigs.isDefault, true));
  }

  const updateData: Partial<InsertAiProviderConfig> = { ...data };
  if (data.apiKey) {
    updateData.apiKey = encrypt(data.apiKey);
  }

  await db.update(aiProviderConfigs).set(updateData).where(eq(aiProviderConfigs.id, id));
}

export async function deleteProviderConfig(id: number): Promise<void> {
  const db = await requireDb();
  // Soft delete: disable instead of removing
  await db.update(aiProviderConfigs).set({ isEnabled: false }).where(eq(aiProviderConfigs.id, id));
}

export async function getDefaultProviderConfig(): Promise<AiProviderConfig | undefined> {
  const db = await requireDb();
  const rows = await db.select().from(aiProviderConfigs)
    .where(and(eq(aiProviderConfigs.isDefault, true), eq(aiProviderConfigs.isEnabled, true)))
    .limit(1);
  return rows[0];
}

// ==================== Search Config ====================

export async function listSearchConfigs(): Promise<AiSearchConfig[]> {
  const db = await requireDb();
  return db.select().from(aiSearchConfigs).orderBy(desc(aiSearchConfigs.createdAt));
}

export async function getSearchConfig(id: number): Promise<AiSearchConfig | undefined> {
  const db = await requireDb();
  const rows = await db.select().from(aiSearchConfigs).where(eq(aiSearchConfigs.id, id)).limit(1);
  return rows[0];
}

export async function createSearchConfig(data: InsertAiSearchConfig): Promise<number> {
  const db = await requireDb();

  // If setting as default, clear other defaults first
  if (data.isDefault) {
    await db.update(aiSearchConfigs).set({ isDefault: false }).where(eq(aiSearchConfigs.isDefault, true));
  }

  const result = await db.insert(aiSearchConfigs).values({
    ...data,
    apiKey: encrypt(data.apiKey),
  });
  return Number((result[0] as { insertId: number }).insertId);
}

export async function updateSearchConfig(id: number, data: Partial<InsertAiSearchConfig>): Promise<void> {
  const db = await requireDb();

  // If setting as default, clear other defaults first
  if (data.isDefault) {
    await db.update(aiSearchConfigs).set({ isDefault: false }).where(eq(aiSearchConfigs.isDefault, true));
  }

  const updateData: Partial<InsertAiSearchConfig> = { ...data };
  if (data.apiKey) {
    updateData.apiKey = encrypt(data.apiKey);
  }

  await db.update(aiSearchConfigs).set(updateData).where(eq(aiSearchConfigs.id, id));
}

export async function deleteSearchConfig(id: number): Promise<void> {
  const db = await requireDb();
  // Soft delete: disable instead of removing
  await db.update(aiSearchConfigs).set({ isEnabled: false }).where(eq(aiSearchConfigs.id, id));
}

export async function getDefaultSearchConfig(): Promise<AiSearchConfig | undefined> {
  const db = await requireDb();
  const rows = await db.select().from(aiSearchConfigs)
    .where(and(eq(aiSearchConfigs.isDefault, true), eq(aiSearchConfigs.isEnabled, true)))
    .limit(1);
  return rows[0];
}

// ==================== Conversation ====================

export async function listConversationsByUserId(userId: number): Promise<AiConversation[]> {
  const db = await requireDb();
  return db.select().from(aiConversations)
    .where(eq(aiConversations.userId, userId))
    .orderBy(desc(aiConversations.updatedAt));
}

export async function getConversation(id: number, userId: number): Promise<AiConversation | null> {
  const db = await requireDb();
  const rows = await db.select().from(aiConversations)
    .where(and(eq(aiConversations.id, id), eq(aiConversations.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createConversation(data: InsertAiConversation): Promise<number> {
  const db = await requireDb();
  const result = await db.insert(aiConversations).values(data);
  return Number((result[0] as { insertId: number }).insertId);
}

export async function updateConversationTitle(id: number, title: string): Promise<void> {
  const db = await requireDb();
  await db.update(aiConversations).set({ title }).where(eq(aiConversations.id, id));
}

export async function deleteConversation(id: number): Promise<void> {
  const db = await requireDb();
  // Delete messages first (foreign key), then the conversation
  await db.delete(aiMessages).where(eq(aiMessages.conversationId, id));
  await db.delete(aiConversations).where(eq(aiConversations.id, id));
}

// ==================== Messages ====================

export async function listMessages(conversationId: number): Promise<AiMessage[]> {
  const db = await requireDb();
  return db.select().from(aiMessages)
    .where(eq(aiMessages.conversationId, conversationId))
    .orderBy(desc(aiMessages.createdAt));
}

export async function createMessage(data: InsertAiMessage): Promise<number> {
  const db = await requireDb();
  const result = await db.insert(aiMessages).values(data);
  return Number((result[0] as { insertId: number }).insertId);
}

export async function getRecentMessages(conversationId: number, limit: number): Promise<AiMessage[]> {
  const db = await requireDb();
  const rows = await db.select().from(aiMessages)
    .where(eq(aiMessages.conversationId, conversationId))
    .orderBy(desc(aiMessages.createdAt))
    .limit(limit);
  // Return in chronological order (oldest first)
  return rows.reverse();
}

// ==================== Encryption Helpers ====================

export function decryptConfigKey(config: AiProviderConfig): string {
  return decrypt(config.apiKey);
}

export function maskConfigKey(config: AiProviderConfig): string {
  return maskApiKey(decrypt(config.apiKey));
}

export function decryptSearchKey(config: AiSearchConfig): string {
  return decrypt(config.apiKey);
}

export function maskSearchKey(config: AiSearchConfig): string {
  return maskApiKey(decrypt(config.apiKey));
}
