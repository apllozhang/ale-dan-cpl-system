import { eq, desc } from "drizzle-orm";
import {
  aiKnowledgeBases,
  aiKnowledgeDocs,
  type AiKnowledgeBase,
  type InsertAiKnowledgeBase,
  type AiKnowledgeDoc,
  type InsertAiKnowledgeDoc,
} from "../../drizzle/schema";
import { requireDb } from "./index";

// ==================== Knowledge Base ====================

export async function listKnowledgeBases(): Promise<AiKnowledgeBase[]> {
  const db = await requireDb();
  return db.select().from(aiKnowledgeBases).orderBy(desc(aiKnowledgeBases.createdAt));
}

export async function getKnowledgeBase(id: number): Promise<AiKnowledgeBase | undefined> {
  const db = await requireDb();
  const rows = await db.select().from(aiKnowledgeBases).where(eq(aiKnowledgeBases.id, id)).limit(1);
  return rows[0];
}

export async function createKnowledgeBase(data: InsertAiKnowledgeBase): Promise<number> {
  const db = await requireDb();
  const result = await db.insert(aiKnowledgeBases).values(data);
  return Number((result[0] as { insertId: number }).insertId);
}

export async function deleteKnowledgeBase(id: number): Promise<void> {
  const db = await requireDb();
  // Delete docs first (foreign key), then the knowledge base
  await db.delete(aiKnowledgeDocs).where(eq(aiKnowledgeDocs.knowledgeBaseId, id));
  await db.delete(aiKnowledgeBases).where(eq(aiKnowledgeBases.id, id));
}

// ==================== Knowledge Doc ====================

export async function listKnowledgeDocs(knowledgeBaseId: number): Promise<AiKnowledgeDoc[]> {
  const db = await requireDb();
  return db.select().from(aiKnowledgeDocs)
    .where(eq(aiKnowledgeDocs.knowledgeBaseId, knowledgeBaseId))
    .orderBy(desc(aiKnowledgeDocs.createdAt));
}

export async function createKnowledgeDoc(data: InsertAiKnowledgeDoc): Promise<number> {
  const db = await requireDb();
  const result = await db.insert(aiKnowledgeDocs).values(data);
  return Number((result[0] as { insertId: number }).insertId);
}

export async function updateKnowledgeDoc(id: number, data: Partial<InsertAiKnowledgeDoc>): Promise<void> {
  const db = await requireDb();
  await db.update(aiKnowledgeDocs).set(data).where(eq(aiKnowledgeDocs.id, id));
}

// ==================== Search ====================

/**
 * Keyword-match search across a knowledge base.
 * Matches docs whose extractedText contains any of the query keywords.
 * Falls back to returning the first few docs if no keyword match is found.
 */
export async function searchKnowledgeBase(
  knowledgeBaseId: number,
  query: string,
  maxChars: number = 4000,
): Promise<string> {
  const db = await requireDb();
  const docs = await db.select().from(aiKnowledgeDocs)
    .where(eq(aiKnowledgeDocs.knowledgeBaseId, knowledgeBaseId));

  // Tokenize query into lowercase keywords
  const keywords = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (keywords.length === 0) return "";

  // Collect matching docs
  const matched: string[] = [];
  let totalChars = 0;

  for (const doc of docs) {
    const text = doc.extractedText ?? "";
    const lower = text.toLowerCase();

    if (keywords.some((kw) => lower.includes(kw))) {
      if (totalChars + text.length > maxChars) {
        const remaining = maxChars - totalChars;
        if (remaining > 0) {
          matched.push(text.slice(0, remaining));
        }
        break;
      }
      matched.push(text);
      totalChars += text.length;
    }
  }

  // If keyword match found, return concatenated results
  if (matched.length > 0) {
    return matched.join("\n\n");
  }

  // Fallback: return first few docs' text
  const fallback: string[] = [];
  let fbChars = 0;
  for (const doc of docs) {
    const text = doc.extractedText ?? "";
    if (!text) continue;
    if (fbChars + text.length > maxChars) {
      const remaining = maxChars - fbChars;
      if (remaining > 0) {
        fallback.push(text.slice(0, remaining));
      }
      break;
    }
    fallback.push(text);
    fbChars += text.length;
  }

  return fallback.join("\n\n");
}
