import { eq, and, or, like, desc, sql, inArray, between } from "drizzle-orm";
import { getDb } from "./index";
import { eflashRecords, eflashTags, eflashRecordTags, eflashAttachments } from "../../drizzle/schema";
import type { InsertEFlashRecord, InsertEFlashTag, InsertEFlashAttachment } from "../../drizzle/schema";

// ==================== Records ====================

export async function listEFlashRecords(params: {
  page?: number;
  pageSize?: number;
  type?: string;
  division?: string;
  scope?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  tagIds?: number[];
}) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const page = params.page || 1;
  const pageSize = Math.min(params.pageSize || 20, 100);
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (params.type) conditions.push(eq(eflashRecords.type, params.type as "phase_in" | "phase_out" | "service" | "pricing" | "program"));
  if (params.division) conditions.push(eq(eflashRecords.division, params.division as "communications" | "network" | "general"));
  if (params.scope) conditions.push(eq(eflashRecords.scope, params.scope as "global" | "china"));
  if (params.search) {
    const s = `%${params.search}%`;
    conditions.push(or(
      like(eflashRecords.eflashId, s),
      like(eflashRecords.subjectEn, s),
      like(eflashRecords.subjectCn, s),
    )!);
  }

  // Tag filtering via join
  if (params.tagIds && params.tagIds.length > 0) {
    const tagCondition = sql`EXISTS (
      SELECT 1 FROM eflash_record_tags
      WHERE eflash_record_tags.recordId = eflash_records.id
      AND eflash_record_tags.tagId IN (${sql.join(params.tagIds.map(id => sql`${id}`), sql`, `)})
    )`;
    conditions.push(tagCondition);
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(eflashRecords)
    .where(where);
  const total = Number(countResult.count);

  const items = await db
    .select()
    .from(eflashRecords)
    .where(where)
    .orderBy(desc(eflashRecords.effectiveDate), desc(eflashRecords.createdAt))
    .limit(pageSize)
    .offset(offset);

  return { items, total };
}

export async function getEFlashRecordById(id: number) {
  const db = await getDb();
  if (!db) return null;

  const [record] = await db
    .select()
    .from(eflashRecords)
    .where(eq(eflashRecords.id, id));

  if (!record) return null;

  // Fetch tags
  const tags = await db
    .select({ id: eflashTags.id, name: eflashTags.name, category: eflashTags.category })
    .from(eflashRecordTags)
    .innerJoin(eflashTags, eq(eflashRecordTags.tagId, eflashTags.id))
    .where(eq(eflashRecordTags.recordId, id));

  // Fetch attachments
  const attachments = await db
    .select()
    .from(eflashAttachments)
    .where(eq(eflashAttachments.recordId, id));

  return { ...record, tags, attachments };
}

export async function createEFlashRecord(data: InsertEFlashRecord, tagIds?: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [result] = await db.insert(eflashRecords).values(data);
  const id = Number(result.insertId);

  if (tagIds && tagIds.length > 0) {
    await db.insert(eflashRecordTags).values(
      tagIds.map(tagId => ({ recordId: id, tagId }))
    );
  }

  return id;
}

export async function updateEFlashRecord(id: number, data: Partial<InsertEFlashRecord>, tagIds?: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(eflashRecords).set(data).where(eq(eflashRecords.id, id));

  // Replace tags if provided
  if (tagIds !== undefined) {
    await db.delete(eflashRecordTags).where(eq(eflashRecordTags.recordId, id));
    if (tagIds.length > 0) {
      await db.insert(eflashRecordTags).values(
        tagIds.map(tagId => ({ recordId: id, tagId }))
      );
    }
  }

  return id;
}

export async function deleteEFlashRecord(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Fetch attachments to delete files
  const attachments = await db
    .select()
    .from(eflashAttachments)
    .where(eq(eflashAttachments.recordId, id));

  // Delete DB records (cascade handles record_tags and attachments)
  await db.delete(eflashRecords).where(eq(eflashRecords.id, id));

  // Delete physical files
  const fs = await import("fs/promises");
  for (const att of attachments) {
    try {
      await fs.unlink(att.filePath);
    } catch { /* file may already be gone */ }
  }

  return true;
}

export async function getEFlashRecordByEFlashId(eflashId: string) {
  const db = await getDb();
  if (!db) return null;

  const [record] = await db
    .select()
    .from(eflashRecords)
    .where(eq(eflashRecords.eflashId, eflashId));

  return record || null;
}

// ==================== Tags ====================

export async function listEFlashTags(category?: string) {
  const db = await getDb();
  if (!db) return [];

  const where = category
    ? eq(eflashTags.category, category as "region" | "product")
    : undefined;

  return db.select().from(eflashTags).where(where).orderBy(eflashTags.name);
}

export async function findOrCreateTag(name: string, category: "region" | "product") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [existing] = await db
    .select()
    .from(eflashTags)
    .where(and(eq(eflashTags.name, name), eq(eflashTags.category, category)));

  if (existing) return existing.id;

  const [result] = await db.insert(eflashTags).values({ name, category });
  return Number(result.insertId);
}

// ==================== Attachments ====================

export async function createAttachment(data: InsertEFlashAttachment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [result] = await db.insert(eflashAttachments).values(data);
  return Number(result.insertId);
}

export async function deleteAttachment(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [att] = await db.select().from(eflashAttachments).where(eq(eflashAttachments.id, id));
  if (att) {
    const fs = await import("fs/promises");
    try { await fs.unlink(att.filePath); } catch { /* ignore */ }
  }

  await db.delete(eflashAttachments).where(eq(eflashAttachments.id, id));
  return true;
}

// ==================== Stats ====================

export async function getEFlashStats() {
  const db = await getDb();
  if (!db) return { byType: {}, recentCount: 0 };

  const byType = await db
    .select({ type: eflashRecords.type, count: sql<number>`count(*)` })
    .from(eflashRecords)
    .groupBy(eflashRecords.type);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [recentResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(eflashRecords)
    .where(sql`${eflashRecords.createdAt} >= ${thirtyDaysAgo}`);

  return {
    byType: Object.fromEntries(byType.map(r => [r.type, Number(r.count)])),
    recentCount: Number(recentResult.count),
  };
}

// ==================== Excel Import ====================

const TYPE_MAP: Record<string, "phase_in" | "phase_out" | "service" | "pricing" | "program"> = {
  "phase-in": "phase_in",
  "phase_out": "phase_out",
  "phase-out": "phase_out",
  "service": "service",
  "pricing": "pricing",
  "program": "program",
};

export async function importEFlashFromRows(
  rows: Array<{
    eflashId: string;
    type: string;
    division: string;
    scope: string;
    subjectEn?: string;
    subjectCn?: string;
    globalDate?: Date | null;
    chinaDate?: Date | null;
    effectiveDate?: Date | null;
    authorEn?: string;
    authorCn?: string;
    comments?: string;
  }>,
  createdBy: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  let created = 0;
  let updated = 0;
  let failed = 0;
  const errors: Array<{ row: number; reason: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const normalizedType = TYPE_MAP[row.type?.toLowerCase().trim()];
      if (!normalizedType) {
        errors.push({ row: i + 3, reason: `Unknown type: ${row.type}` });
        failed++;
        continue;
      }

      const existing = await getEFlashRecordByEFlashId(row.eflashId.trim());
      const data = {
        eflashId: row.eflashId.trim(),
        type: normalizedType,
        division: row.division as "communications" | "network" | "general",
        scope: row.scope as "global" | "china",
        subjectEn: row.subjectEn || null,
        subjectCn: row.subjectCn || null,
        globalDate: row.globalDate || null,
        chinaDate: row.chinaDate || null,
        effectiveDate: row.effectiveDate || null,
        authorEn: row.authorEn || null,
        authorCn: row.authorCn || null,
        comments: row.comments || null,
        createdBy,
      };

      if (existing) {
        await db.update(eflashRecords)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(eflashRecords.id, existing.id));
        updated++;
      } else {
        await db.insert(eflashRecords).values(data);
        created++;
      }
    } catch (err) {
      errors.push({ row: i + 3, reason: String(err) });
      failed++;
    }
  }

  return { created, updated, failed, errors };
}
