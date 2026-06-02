import { eq, and, sql, desc, lte } from "drizzle-orm";
import {
  certifications, productCertifications,
  type InsertCertification,
} from "../../drizzle/schema";
import { getDb } from "./index";

export async function listCertifications(params: {
  certType?: string;
  status?: string;
  standardType?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
}) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (params.certType) conditions.push(eq(certifications.certType, params.certType));
  if (params.status) conditions.push(eq(certifications.status, params.status));
  if (params.standardType) conditions.push(eq(certifications.standardType, params.standardType));
  if (params.keyword) {
    const kw = `%${params.keyword}%`;
    conditions.push(
      sql`(${certifications.certNo} LIKE ${kw} OR ${certifications.certName} LIKE ${kw} OR ${certifications.holder} LIKE ${kw})`
    );
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const countResult = await db.select({ total: sql<number>`COUNT(*)` }).from(certifications).where(whereClause);
  const total = Number((Array.isArray(countResult[0]) ? countResult[0][0] : countResult[0])?.total ?? 0);

  const items = await db.select().from(certifications)
    .where(whereClause)
    .orderBy(desc(certifications.createdAt))
    .limit(pageSize)
    .offset(offset);

  return { items, total };
}

export async function getCertificationById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(certifications).where(eq(certifications.id, id));
  const cert = Array.isArray(rows[0]) ? rows[0][0] : rows[0];
  if (!cert) return null;

  const links = await db.select().from(productCertifications)
    .where(eq(productCertifications.certificationId, id));

  return { ...cert, productModels: links.map(l => l.productModel) };
}

export async function getCertificationsByProduct(productModel: string) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(certifications)
    .innerJoin(productCertifications, eq(certifications.id, productCertifications.certificationId))
    .where(eq(productCertifications.productModel, productModel))
    .orderBy(desc(certifications.createdAt));
  return rows.map((r) => r.certifications);
}

export async function getExpiringCertifications(days: number) {
  const db = await getDb();
  if (!db) return [];
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  const futureStr = futureDate.toISOString().split("T")[0];

  const rows = await db.select().from(certifications)
    .where(
      and(
        lte(certifications.expiryDate, futureStr),
        sql`${certifications.expiryDate} IS NOT NULL`,
        sql`${certifications.status} != 'revoked'`
      )
    )
    .orderBy(certifications.expiryDate);

  return rows;
}

export async function createCertification(data: InsertCertification, productModels?: string[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(certifications).values(data);
  const insertId = (result as any)[0]?.insertId ?? (result as any).insertId;

  if (productModels && productModels.length > 0) {
    const BATCH = 200;
    for (let i = 0; i < productModels.length; i += BATCH) {
      const batch = productModels.slice(i, i + BATCH).map(model => ({
        certificationId: insertId,
        productModel: model,
      }));
      await db.insert(productCertifications).values(batch);
    }
  }

  return insertId;
}

export async function updateCertification(id: number, data: Partial<InsertCertification>, productModels?: string[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(certifications).set(data).where(eq(certifications.id, id));

  if (productModels !== undefined) {
    await db.delete(productCertifications).where(eq(productCertifications.certificationId, id));
    if (productModels.length > 0) {
      const BATCH = 200;
      for (let i = 0; i < productModels.length; i += BATCH) {
        const batch = productModels.slice(i, i + BATCH).map(model => ({
          certificationId: id,
          productModel: model,
        }));
        await db.insert(productCertifications).values(batch);
      }
    }
  }
}

export async function deleteCertification(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(productCertifications).where(eq(productCertifications.certificationId, id));
  await db.delete(certifications).where(eq(certifications.id, id));
}

export async function bulkInsertCertifications(items: InsertCertification[]) {
  const db = await getDb();
  if (!db) return;
  const BATCH = 200;
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH);
    await db.insert(certifications).values(batch);
  }
}

export async function getCertificationByCertNo(certNo: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(certifications).where(eq(certifications.certNo, certNo));
  return Array.isArray(rows[0]) ? rows[0][0] : rows[0] ?? null;
}
