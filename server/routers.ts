import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { SignJWT, jwtVerify } from "jose";
import { ENV } from "./_core/env";
import * as db from "./db";
import * as XLSX from "xlsx";
import { hash, compare } from "bcryptjs";

function getSessionSecret() {
  return new TextEncoder().encode(ENV.cookieSecret);
}

async function createLocalSession(openId: string, name: string): Promise<string> {
  const issuedAt = Date.now();
  const expirationSeconds = Math.floor((issuedAt + ONE_YEAR_MS) / 1000);
  return new SignJWT({
    openId,
    appId: ENV.appId,
    name,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(expirationSeconds)
    .sign(getSessionSecret());
}

// Column name mapping for various sheet formats
const COLUMN_MAP: Record<string, string> = {
  "产品组件": "productGroup",
  "OmniVista 2500 Partner Support Software": "productGroup",
  "税务小类": "taxCategory",
  "线缆": "taxCategory",
  "类别": "taxCategory",
  "产品型号": "productModel",
  "型号": "productModel",
  "产品说明": "productDesc",
  "描述": "productDesc",
  "销售类别": "salesCategory",
  "服务类别": "serviceCategory",
  "产品状态": "productStatus",
  "服务状态": "productStatus",
  "状态": "productStatus",
  "媒体价": "listPrice",
  "价格说明": "priceNote",
  "新品": "isNew",
  "备注": "remark",
  "注释": "remark",
  "子类别": "serviceCategory",
};

function parseExcelBuffer(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetsToSkip = ["Summary", "LBS场景化报价模型"];
  const products: any[] = [];
  const sheetMeta: { sheetName: string; displayOrder: number; productCount: number }[] = [];

  // Parse Summary sheet
  let summaryContent = "";
  if (workbook.SheetNames.includes("Summary")) {
    const ws = workbook.Sheets["Summary"];
    const data = XLSX.utils.sheet_to_json<any>(ws, { header: 1 });
    const lines: string[] = [];
    for (const row of data) {
      if (Array.isArray(row)) {
        const text = row.filter((c: any) => c !== null && c !== undefined && c !== "").join(" ").trim();
        if (text) lines.push(text);
      }
    }
    summaryContent = lines.join("\n");
  }

  // Parse product sheets
  let order = 0;
  for (const sheetName of workbook.SheetNames) {
    if (sheetsToSkip.includes(sheetName)) continue;
    const trimmedName = sheetName.trim();
    const ws = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });

    let count = 0;
    for (const row of rows) {
      const mapped: Record<string, string> = {};
      for (const [key, value] of Object.entries(row)) {
        const mappedKey = COLUMN_MAP[key.trim()];
        if (mappedKey) {
          mapped[mappedKey] = value != null ? String(value).trim() : "";
        }
      }
      // Skip empty rows
      if (!mapped.productModel && !mapped.productDesc && !mapped.productGroup) continue;

      products.push({
        sheetName: trimmedName,
        productGroup: mapped.productGroup || "",
        taxCategory: mapped.taxCategory || "",
        productModel: mapped.productModel || "",
        productDesc: mapped.productDesc || "",
        salesCategory: mapped.salesCategory || "",
        serviceCategory: mapped.serviceCategory || "",
        productStatus: mapped.productStatus || "",
        listPrice: mapped.listPrice || "",
        priceNote: mapped.priceNote || "",
        isNew: mapped.isNew || "",
        remark: mapped.remark || "",
      });
      count++;
    }

    sheetMeta.push({ sheetName: trimmedName, displayOrder: order++, productCount: count });
  }

  return { products, sheetMeta, summaryContent };
}

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    login: publicProcedure
      .input(z.object({
        username: z.string(),
        password: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await db.getUserByUsername(input.username);
        if (!user || !user.passwordHash) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "用户名或密码错误",
          });
        }

        const valid = await compare(input.password, user.passwordHash);
        if (!valid) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "用户名或密码错误",
          });
        }

        // Update lastSignedIn
        await db.upsertUser({
          openId: user.openId,
          lastSignedIn: new Date(),
        });

        // Create session token
        const token = await createLocalSession(user.openId, user.name || user.username || "User");
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });

        return { success: true, name: user.name || user.username };
      }),
  }),

  users: router({
    list: adminProcedure.query(async () => {
      return db.getAllUsers();
    }),
    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getUserById(input.id);
      }),
    create: adminProcedure
      .input(z.object({
        username: z.string().min(3).max(64),
        password: z.string().min(6),
        name: z.string().optional(),
        email: z.string().email().optional(),
        role: z.enum(["user", "admin"]).default("user"),
      }))
      .mutation(async ({ input }) => {
        const existingUser = await db.getUserByUsername(input.username);
        if (existingUser) {
          throw new TRPCError({ code: "CONFLICT", message: "用户名已存在" });
        }
        const passwordHash = await hash(input.password, 10);
        return db.createUser({
          username: input.username,
          passwordHash,
          name: input.name,
          email: input.email,
          role: input.role,
        });
      }),
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        username: z.string().min(3).max(64).optional(),
        password: z.string().min(6).optional(),
        name: z.string().optional(),
        email: z.string().email().optional(),
        role: z.enum(["user", "admin"]).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, password, username, ...rest } = input;
        const updateData: any = { ...rest };
        if (password) {
          updateData.passwordHash = await hash(password, 10);
        }
        if (username) {
          const existing = await db.getUserByUsername(username);
          if (existing && existing.id !== id) {
            throw new TRPCError({ code: "CONFLICT", message: "用户名已存在" });
          }
          updateData.username = username;
        }
        return db.updateUser(id, updateData);
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.deleteUser(input.id);
      }),
  }),

  quotations: router({
    list: protectedProcedure
      .input(z.object({
        search: z.string().optional(),
        status: z.string().optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
        sortBy: z.string().optional(),
        sortOrder: z.enum(["asc", "desc"]).default("desc"),
      }))
      .query(async ({ input, ctx }) => {
        return db.getQuotations({
          ...input,
          createdBy: ctx.user.role === "admin" ? undefined : ctx.user.id,
        });
      }),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getQuotationById(input.id);
      }),
    create: protectedProcedure
      .input(z.object({
        customerName: z.string().min(1),
        customerContact: z.string().optional(),
        customerPhone: z.string().optional(),
        customerEmail: z.string().optional(),
        projectName: z.string().optional(),
        discountRate: z.number().optional(),
        notes: z.string().optional(),
        validUntil: z.string().optional(),
        items: z.array(z.object({
          productId: z.number().optional(),
          productModel: z.string(),
          productDesc: z.string().optional(),
          listPrice: z.string().optional(),
          quantity: z.number().min(1).default(1),
          unitPrice: z.number().optional(),
          discountRate: z.number().optional(),
        })),
      }))
      .mutation(async ({ input, ctx }) => {
        const { items, validUntil, ...quotationData } = input;
        const quotation = {
          ...quotationData,
          quotationNo: "",
          status: "draft" as const,
          totalAmount: "0",
          discountRate: String(input.discountRate ?? 0),
          validUntil: validUntil ? new Date(validUntil) : undefined,
          createdBy: ctx.user.id,
        };
        const createdQuotation = await db.createQuotation(quotation, []);
        const processedItems = items.map(item => {
          const unitPrice = item.unitPrice ?? parseFloat(item.listPrice || "0");
          const discount = item.discountRate ?? input.discountRate ?? 0;
          const subtotal = unitPrice * item.quantity * (1 - discount / 100);
          return {
            quotationId: createdQuotation.id,
            productId: item.productId ?? null,
            productModel: item.productModel,
            productDesc: item.productDesc ?? null,
            listPrice: item.listPrice ?? null,
            quantity: item.quantity,
            unitPrice: String(unitPrice),
            discountRate: String(discount),
            subtotal: String(subtotal),
          };
        });
        const totalAmount = processedItems.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);
        return db.updateQuotation(createdQuotation.id, {
          totalAmount: String(totalAmount),
        }, processedItems);
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        customerName: z.string().min(1).optional(),
        customerContact: z.string().optional(),
        customerPhone: z.string().optional(),
        customerEmail: z.string().optional(),
        projectName: z.string().optional(),
        discountRate: z.number().optional(),
        notes: z.string().optional(),
        validUntil: z.string().optional(),
        items: z.array(z.object({
          productId: z.number().optional(),
          productModel: z.string(),
          productDesc: z.string().optional(),
          listPrice: z.string().optional(),
          quantity: z.number().min(1).default(1),
          unitPrice: z.number().optional(),
          discountRate: z.number().optional(),
        })).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, items, validUntil, ...quotationData } = input;
        let processedItems = undefined;
        let totalAmount = undefined;
        if (items) {
          processedItems = items.map(item => {
            const unitPrice = item.unitPrice ?? parseFloat(item.listPrice || "0");
            const discount = item.discountRate ?? input.discountRate ?? 0;
            const subtotal = unitPrice * item.quantity * (1 - discount / 100);
            return {
              quotationId: id,
              productId: item.productId ?? null,
              productModel: item.productModel,
              productDesc: item.productDesc ?? null,
              listPrice: item.listPrice ?? null,
              quantity: item.quantity,
              unitPrice: String(unitPrice),
              discountRate: String(discount),
              subtotal: String(subtotal),
            };
          });
          totalAmount = String(processedItems.reduce((sum, item) => sum + parseFloat(item.subtotal), 0));
        }
        return db.updateQuotation(id, {
          ...quotationData,
          totalAmount,
          discountRate: input.discountRate !== undefined ? String(input.discountRate) : undefined,
          validUntil: validUntil ? new Date(validUntil) : undefined,
        }, processedItems);
      }),
    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["draft", "submitted", "approved", "sent", "completed", "cancelled"]),
      }))
      .mutation(async ({ input }) => {
        return db.updateQuotationStatus(input.id, input.status);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.deleteQuotation(input.id);
      }),
  }),

  cpl: router({
    // Get all sheets
    sheets: publicProcedure.query(async () => {
      return db.getCplSheets();
    }),

    // Get products with filtering, pagination, sorting
    products: publicProcedure
      .input(z.object({
        sheetName: z.string().optional(),
        search: z.string().optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(200).default(50),
        sortBy: z.string().optional(),
        sortOrder: z.enum(["asc", "desc"]).default("asc"),
        filters: z.record(z.string(), z.string()).optional(),
      }))
      .query(async ({ input }) => {
        return db.getCplProducts(input);
      }),

    // Get latest summary
    summary: publicProcedure.query(async () => {
      return db.getLatestSummary();
    }),

    // Import Excel file
    import: protectedProcedure
      .input(z.object({
        fileBase64: z.string(),
        fileName: z.string(),
      }))
      .mutation(async ({ input }) => {
        const buffer = Buffer.from(input.fileBase64, "base64");
        const { products, sheetMeta, summaryContent } = parseExcelBuffer(buffer);

        // Clear existing data and insert new
        await db.clearAllProducts();
        await db.clearAndInsertSheets(sheetMeta);

        if (products.length > 0) {
          await db.bulkInsertProducts(products);
        }

        if (summaryContent) {
          await db.insertSummary({
            content: summaryContent,
            version: input.fileName,
          });
        }

        return {
          success: true,
          sheetsImported: sheetMeta.length,
          productsImported: products.length,
          hasSummary: !!summaryContent,
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
