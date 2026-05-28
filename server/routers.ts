import { COOKIE_NAME, ONE_YEAR_MS, PERMISSIONS, hasPermission, QUOTATION_STATUS_TRANSITIONS, QUOTATION_STATUS_LABELS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, superAdminProcedure, permissionProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { SignJWT, jwtVerify } from "jose";
import { ENV } from "./_core/env";
import * as db from "./db";
import * as XLSX from "xlsx";
import { hash, compare } from "bcryptjs";
import { randomBytes } from "crypto";

function logActivity(ctx: any, params: {
  action: string;
  resourceType?: string | null;
  resourceId?: number | null;
  detail?: Record<string, unknown>;
}) {
  return db.createActivityLog({
    userId: ctx.user.id,
    username: ctx.user.username || ctx.user.name || "",
    action: params.action,
    resourceType: params.resourceType ?? null,
    resourceId: params.resourceId ?? null,
    detail: params.detail ? JSON.stringify(params.detail) : null,
    ipAddress: ctx.req.ip || ctx.req.headers["x-forwarded-for"] as string || null,
  }).catch(() => {});
}

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
    logout: publicProcedure.mutation(async ({ ctx }) => {
      if (ctx.user) {
        await logActivity(ctx, { action: "logout", resourceType: "auth" });
      }
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    login: publicProcedure
      .input(z.object({
        username: z.string().max(128),
        password: z.string().max(128),
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

        // Audit log
        await logActivity({ user, req: ctx.req }, {
          action: "login", resourceType: "auth", detail: { method: "local" },
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

  organizations: router({
    list: superAdminProcedure.query(async () => {
      return db.getAllOrganizations();
    }),
    create: superAdminProcedure
      .input(z.object({ name: z.string().min(1).max(128) }))
      .mutation(async ({ input, ctx }) => {
        const result = await db.createOrganization(input);
        await logActivity(ctx, { action: "create_organization", resourceType: "organization", detail: { name: input.name } });
        return result;
      }),
    update: superAdminProcedure
      .input(z.object({ id: z.number(), name: z.string().min(1).max(128) }))
      .mutation(async ({ input, ctx }) => {
        const result = await db.updateOrganization(input.id, { name: input.name });
        await logActivity(ctx, { action: "update_organization", resourceType: "organization", resourceId: input.id, detail: { name: input.name } });
        return result;
      }),
    delete: superAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await logActivity(ctx, { action: "delete_organization", resourceType: "organization", resourceId: input.id, detail: { id: input.id } });
        return db.deleteOrganization(input.id);
      }),
  }),

  userGroups: router({
    list: superAdminProcedure.query(async () => {
      return db.getAllUserGroups();
    }),
    create: superAdminProcedure
      .input(z.object({ name: z.string().min(1).max(128), organizationId: z.number() }))
      .mutation(async ({ input }) => {
        return db.createUserGroup(input);
      }),
    update: superAdminProcedure
      .input(z.object({ id: z.number(), name: z.string().min(1).max(128).optional(), organizationId: z.number().optional() }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateUserGroup(id, data);
      }),
    delete: superAdminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.deleteUserGroup(input.id);
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
        role: z.enum(["user", "admin", "sales_manager", "sales_rep", "viewer"]).default("user"),
        isSuperAdmin: z.boolean().optional(),
        organizationId: z.number().optional(),
        groupId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const existingUser = await db.getUserByUsername(input.username);
        if (existingUser) {
          throw new TRPCError({ code: "CONFLICT", message: "用户名已存在" });
        }
        const passwordHash = await hash(input.password, 10);
        const result = await db.createUser({
          username: input.username,
          passwordHash,
          name: input.name,
          email: input.email,
          role: input.role,
          isSuperAdmin: input.isSuperAdmin,
          organizationId: input.organizationId,
          groupId: input.groupId,
        });
        await logActivity(ctx, { action: "create_user", resourceType: "user", detail: { username: input.username, role: input.role } });
        return result;
      }),
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        username: z.string().min(3).max(64).optional(),
        password: z.string().min(6).max(128).optional(),
        name: z.string().optional(),
        email: z.string().email().optional(),
        role: z.enum(["user", "admin", "sales_manager", "sales_rep", "viewer"]).optional(),
        isSuperAdmin: z.boolean().optional(),
        organizationId: z.number().nullable().optional(),
        groupId: z.number().nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, password, username, ...rest } = input;
        // Only super admins can modify isSuperAdmin
        if (rest.isSuperAdmin !== undefined && !ctx.user.isSuperAdmin) {
          delete (rest as any).isSuperAdmin;
        }
        const updateData: any = { ...rest };
        if (password) {
          const target = await db.getUserById(id);
          if (target?.isSuperAdmin) {
            throw new TRPCError({ code: "FORBIDDEN", message: "超管密码不允许修改" });
          }
          updateData.passwordHash = await hash(password, 10);
        }
        if (username) {
          const existing = await db.getUserByUsername(username);
          if (existing && existing.id !== id) {
            throw new TRPCError({ code: "CONFLICT", message: "用户名已存在" });
          }
          updateData.username = username;
        }
        const result = await db.updateUser(id, updateData);
        await logActivity(ctx, { action: "update_user", resourceType: "user", resourceId: id, detail: { username: username || (await db.getUserById(id))?.username } });
        return result;
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const target = await db.getUserById(input.id);
        if (target?.isSuperAdmin) {
          throw new TRPCError({ code: "FORBIDDEN", message: "超级用户不可删除" });
        }
        await logActivity(ctx, { action: "delete_user", resourceType: "user", resourceId: input.id, detail: { username: target?.username || target?.name } });
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
        industry: z.string().optional(),
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
          const subtotal = unitPrice * item.quantity * (discount / 100);
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
        const result = await db.updateQuotation(createdQuotation.id, {
          totalAmount: String(totalAmount),
        }, processedItems);
        await logActivity(ctx, { action: "create_quotation", resourceType: "quotation", resourceId: createdQuotation.id, detail: { customerName: input.customerName, itemCount: items.length } });
        return result;
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        customerName: z.string().min(1).optional(),
        customerContact: z.string().optional(),
        customerPhone: z.string().optional(),
        customerEmail: z.string().optional(),
        industry: z.string().optional(),
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
      .mutation(async ({ input, ctx }) => {
        const { id, items, validUntil, ...quotationData } = input;
        // Ownership check: only owner or admin/sales_manager can update
        const quotation = await db.getQuotationById(id);
        if (!quotation) throw new TRPCError({ code: "NOT_FOUND", message: "报价单不存在" });
        const isAdmin = ["admin", "sales_manager"].includes(ctx.user.role) || ctx.user.isSuperAdmin;
        if (!isAdmin && quotation.createdBy !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "无权编辑此报价单" });
        }
        let processedItems = undefined;
        let totalAmount = undefined;
        if (items) {
          processedItems = items.map(item => {
            const unitPrice = item.unitPrice ?? parseFloat(item.listPrice || "0");
            const discount = item.discountRate ?? input.discountRate ?? 0;
            const subtotal = unitPrice * item.quantity * (discount / 100);
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
        const result = await db.updateQuotation(id, {
          ...quotationData,
          totalAmount,
          discountRate: input.discountRate !== undefined ? String(input.discountRate) : undefined,
          validUntil: validUntil ? new Date(validUntil) : undefined,
        }, processedItems, ctx.user.id);
        await logActivity(ctx, { action: "update_quotation", resourceType: "quotation", resourceId: id, detail: { quotationNo: quotation.quotationNo } });
        return result;
      }),
    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["draft", "submitted", "approved", "sent", "completed", "cancelled"]),
      }))
      .mutation(async ({ input, ctx }) => {
        const quotation = await db.getQuotationById(input.id);
        if (!quotation) throw new TRPCError({ code: "NOT_FOUND", message: "报价单不存在" });
        const isAdmin = ["admin", "sales_manager"].includes(ctx.user.role) || ctx.user.isSuperAdmin;
        if (!isAdmin && quotation.createdBy !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "无权修改此报价单状态" });
        }
        const currentStatus = quotation.status;
        const allowed = QUOTATION_STATUS_TRANSITIONS[currentStatus] || [];
        if (!allowed.includes(input.status)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `不能从"${QUOTATION_STATUS_LABELS[currentStatus] || currentStatus}"变为"${QUOTATION_STATUS_LABELS[input.status] || input.status}"` });
        }
        await db.updateQuotationStatus(input.id, input.status);
        await logActivity(ctx, { action: "update_status", resourceType: "quotation", resourceId: input.id, detail: { quotationNo: quotation.quotationNo, oldStatus: currentStatus, newStatus: input.status } });
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const quotation = await db.getQuotationById(input.id);
        if (!quotation) throw new TRPCError({ code: "NOT_FOUND", message: "报价单不存在" });
        const isAdmin = ["admin", "sales_manager"].includes(ctx.user.role) || ctx.user.isSuperAdmin;
        if (!isAdmin && quotation.createdBy !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "无权删除此报价单" });
        }
        await logActivity(ctx, { action: "delete_quotation", resourceType: "quotation", resourceId: input.id, detail: { quotationNo: quotation.quotationNo, customerName: quotation.customerName } });
        return db.deleteQuotation(input.id);
      }),

    batchUpdateStatus: protectedProcedure
      .input(z.object({
        ids: z.array(z.number()).min(1),
        status: z.enum(["draft", "submitted", "approved", "sent", "completed", "cancelled"]),
      }))
      .mutation(async ({ input, ctx }) => {
        const isAdmin = ["admin", "sales_manager"].includes(ctx.user.role) || ctx.user.isSuperAdmin;
        const validIds: number[] = [];
        for (const id of input.ids) {
          const q = await db.getQuotationById(id);
          if (!q) continue;
          if (!isAdmin && q.createdBy !== ctx.user.id) continue;
          const allowed = QUOTATION_STATUS_TRANSITIONS[q.status] || [];
          if (!allowed.includes(input.status)) continue;
          validIds.push(id);
        }
        if (validIds.length > 0) {
          await db.batchUpdateQuotationStatus(validIds, input.status);
          await logActivity(ctx, { action: "update_status", resourceType: "quotation", detail: { status: input.status, count: validIds.length } });
        }
        return { success: true, updated: validIds.length };
      }),

    batchDelete: protectedProcedure
      .input(z.object({ ids: z.array(z.number()).min(1) }))
      .mutation(async ({ input, ctx }) => {
        const isAdmin = ["admin", "sales_manager"].includes(ctx.user.role) || ctx.user.isSuperAdmin;
        const validIds: number[] = [];
        for (const id of input.ids) {
          const q = await db.getQuotationById(id);
          if (q && (isAdmin || q.createdBy === ctx.user.id)) {
            validIds.push(id);
          }
        }
        if (validIds.length > 0) {
          await db.batchDeleteQuotations(validIds);
          await logActivity(ctx, { action: "delete_quotation", resourceType: "quotation", detail: { count: validIds.length } });
        }
        return { success: true, deleted: validIds.length };
      }),

    analytics: protectedProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }))
      .query(async ({ input, ctx }) => {
        const isAdmin = ['admin', 'sales_manager'].includes(ctx.user.role) || ctx.user.isSuperAdmin;
        return db.getQuotationAnalytics({
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
          userId: isAdmin ? undefined : ctx.user.id,
        });
      }),

    myDashboard: protectedProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }))
      .query(async ({ input, ctx }) => {
        const [stats, recent] = await Promise.all([
          db.getMyDashboardStats(
            ctx.user.id,
            input.startDate ? new Date(input.startDate) : undefined,
            input.endDate ? new Date(input.endDate) : undefined,
          ),
          db.getMyRecentQuotations(ctx.user.id, 5),
        ]);
        return { stats, recent };
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
        sheetNames: z.array(z.string()).optional(),
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

    // Check if existing data exists
    hasData: publicProcedure.query(async () => {
      const count = await db.countCplProducts();
      return { hasData: count > 0, count };
    }),

    stats: publicProcedure.query(async () => {
      return db.getCplStats();
    }),

    // Import Excel file
    import: superAdminProcedure
      .input(z.object({
        fileBase64: z.string().max(50_000_000),
        fileName: z.string(),
        mode: z.enum(["merge", "overwrite"]).default("overwrite"),
      }))
      .mutation(async ({ input, ctx }) => {
        const buffer = Buffer.from(input.fileBase64, "base64");
        const { products, sheetMeta, summaryContent } = parseExcelBuffer(buffer);

        if (input.mode === "overwrite") {
          await db.clearAllProducts();
        }
        // For merge: don't clear, just insert
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

        // Fetch org/group names for logging
        let orgName = "";
        let groupName = "";
        if (ctx.user!.organizationId) {
          const orgs = await db.getAllOrganizations();
          orgName = orgs.find((o: any) => o.id === ctx.user!.organizationId)?.name || "";
        }
        if (ctx.user!.groupId) {
          const groups = await db.getAllUserGroups();
          groupName = groups.find((g: any) => g.id === ctx.user!.groupId)?.name || "";
        }

        // Write import log
        await db.createImportLog({
          fileName: input.fileName,
          userId: ctx.user!.id,
          username: ctx.user!.username || "unknown",
          orgName: orgName || null,
          groupName: groupName || null,
          mode: input.mode,
          sheetsCount: sheetMeta.length,
          productsCount: products.length,
        } as any);

        // Audit log
        await logActivity(ctx, {
          action: "import_data", resourceType: "import",
          detail: { fileName: input.fileName, mode: input.mode, productsCount: products.length },
        });

        return {
          success: true,
          sheetsImported: sheetMeta.length,
          productsImported: products.length,
          hasSummary: !!summaryContent,
        };
      }),
  }),

  importLogs: router({
    list: superAdminProcedure
      .input(z.object({
        search: z.string().optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
      }))
      .query(async ({ input }) => {
        return db.getImportLogs(input);
      }),
    clear: superAdminProcedure.mutation(async () => {
      await db.clearImportLogs();
      return { success: true };
    }),
    export: superAdminProcedure.query(async () => {
      const { items } = await db.getImportLogs({ page: 1, pageSize: 10000 });
      // Format as CSV
      const header = "ID,文件名,用户,组织,用户组,模式,Sheet数,产品数,时间";
      const rows = items.map((l: any) =>
        `${l.id},"${l.fileName}","${l.username}","${l.orgName || ''}","${l.groupName || ''}","${l.mode === 'overwrite' ? '完全覆盖' : '合并'}",${l.sheetsCount},${l.productsCount},"${new Date(l.createdAt).toLocaleString('zh-CN')}"`
      );
      return header + "\n" + rows.join("\n");
    }),
  }),

  // Activity logs (audit trail)
  activityLogs: router({
    list: permissionProcedure(PERMISSIONS.VIEW_ACTIVITY_LOGS)
      .input(z.object({
        search: z.string().optional(),
        action: z.string().optional(),
        resourceType: z.string().optional(),
        userId: z.number().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
      }))
      .query(async ({ input }) => {
        return db.getActivityLogs(input);
      }),
    stats: permissionProcedure(PERMISSIONS.VIEW_ACTIVITY_LOGS)
      .query(async () => {
        return db.getActivityStats();
      }),
    export: permissionProcedure(PERMISSIONS.VIEW_ACTIVITY_LOGS)
      .input(z.object({
        search: z.string().optional(),
        action: z.string().optional(),
        resourceType: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const { items } = await db.getActivityLogs({ ...input, page: 1, pageSize: 10000 });
        const header = "ID,时间,用户,操作,资源类型,资源ID,详情,IP";
        const rows = items.map((l: any) =>
          `${l.id},"${new Date(l.createdAt).toLocaleString("zh-CN")}","${l.username || ""}","${l.action}","${l.resourceType || ""}",${l.resourceId || ""},"${(l.detail || "").slice(0, 200)}","${l.ipAddress || ""}"`
        );
        return header + "\n" + rows.join("\n");
      }),
    clear: superAdminProcedure.mutation(async () => {
      await db.clearActivityLogs();
      return { success: true };
    }),
  }),

  // Quotation templates
  templates: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getQuotationTemplates(ctx.user!.id);
    }),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getQuotationTemplateById(input.id);
      }),
    create: permissionProcedure(PERMISSIONS.CREATE_QUOTATION)
      .input(z.object({
        name: z.string().min(1).max(256),
        description: z.string().optional(),
        isPublic: z.boolean().default(false),
        discountRate: z.number().optional(),
        notes: z.string().optional(),
        validDays: z.number().optional(),
        items: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        return db.createQuotationTemplate({
          ...input,
          createdBy: ctx.user!.id,
        } as any);
      }),
    update: permissionProcedure(PERMISSIONS.CREATE_QUOTATION)
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(256).optional(),
        description: z.string().optional(),
        isPublic: z.boolean().optional(),
        discountRate: z.number().optional(),
        notes: z.string().optional(),
        validDays: z.number().optional(),
        items: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        const template = await db.getQuotationTemplateById(id);
        if (!template) throw new TRPCError({ code: "NOT_FOUND" });
        if (template.createdBy !== ctx.user!.id && !hasPermission(ctx.user!, PERMISSIONS.MANAGE_USERS)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "只能编辑自己的模板" });
        }
        await db.updateQuotationTemplate(id, data as any);
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const template = await db.getQuotationTemplateById(input.id);
        if (!template) throw new TRPCError({ code: "NOT_FOUND" });
        if (template.createdBy !== ctx.user!.id && !hasPermission(ctx.user!, PERMISSIONS.MANAGE_USERS)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "只能删除自己的模板" });
        }
        await db.deleteQuotationTemplate(input.id);
        return { success: true };
      }),
  }),

  // Quotation versions
  versions: router({
    list: protectedProcedure
      .input(z.object({ quotationId: z.number() }))
      .query(async ({ input }) => {
        const versions = await db.getQuotationVersions(input.quotationId);
        return versions.map((v: any) => {
          let parsed = null;
          try { parsed = JSON.parse(v.snapshot); } catch {}
          return {
            id: v.id,
            version: v.version,
            createdBy: v.createdBy,
            createdAt: v.createdAt,
            changeSummary: parsed?.changeSummary ?? null,
            diff: parsed?.diff ?? null,
            totalAmount: parsed?.totalAmount ?? null,
            itemCount: parsed?.items?.length ?? 0,
          };
        });
      }),
    diff: protectedProcedure
      .input(z.object({
        quotationId: z.number(),
        fromVersion: z.number(),
        toVersion: z.number(),
      }))
      .query(async ({ input }) => {
        const versions = await db.getQuotationVersions(input.quotationId);
        const fromV = versions.find((v: any) => v.version === input.fromVersion);
        const toV = versions.find((v: any) => v.version === input.toVersion);
        if (!fromV || !toV) return null;

        let fromData: any = null, toData: any = null;
        try { fromData = JSON.parse(fromV.snapshot); } catch {}
        try { toData = JSON.parse(toV.snapshot); } catch {}
        if (!fromData || !toData) return null;

        const fromItems = new Map<string, any>((fromData.items || []).map((it: any) => [it.productModel, it]));
        const toItems = new Map<string, any>((toData.items || []).map((it: any) => [it.productModel, it]));
        const allModels = Array.from(new Set<string>([...Array.from(fromItems.keys()), ...Array.from(toItems.keys())]));

        const result: any[] = [];
        for (const model of allModels) {
          const fi: any = fromItems.get(model);
          const ti: any = toItems.get(model);
          let change: "added" | "removed" | "modified" | "unchanged" = "unchanged";
          if (!fi) change = "added";
          else if (!ti) change = "removed";
          else if (fi.quantity !== ti.quantity || fi.discountRate !== ti.discountRate || fi.listPrice !== ti.listPrice) change = "modified";

          result.push({
            productModel: model,
            productDesc: ti?.productDesc || fi?.productDesc,
            change,
            before: fi ? { quantity: fi.quantity, listPrice: fi.listPrice, discountRate: fi.discountRate, subtotal: fi.subtotal } : null,
            after: ti ? { quantity: ti.quantity, listPrice: ti.listPrice, discountRate: ti.discountRate, subtotal: ti.subtotal } : null,
          });
        }

        const changeOrder: Record<string, number> = { added: 0, removed: 1, modified: 2, unchanged: 3 };
        return {
          fromVersion: input.fromVersion,
          toVersion: input.toVersion,
          fromTotal: fromData.totalAmount,
          toTotal: toData.totalAmount,
          fromSummary: fromData.changeSummary,
          toSummary: toData.changeSummary,
          items: result.sort((a, b) => changeOrder[a.change] - changeOrder[b.change]),
        };
      }),
  }),

  // Quotation sharing
  sharing: router({
    share: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const q = await db.getQuotationById(input.id);
        if (!q) throw new TRPCError({ code: "NOT_FOUND" });
        if (q.createdBy !== ctx.user!.id && !hasPermission(ctx.user!, PERMISSIONS.EDIT_ALL_QUOTATIONS)) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        if (q.shareToken) return { shareToken: q.shareToken };
        const token = randomBytes(16).toString("hex");
        await db.updateQuotation(input.id, { shareToken: token } as any, undefined);
        return { shareToken: token };
      }),
    getByToken: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        return db.getQuotationByShareToken(input.token);
      }),
  }),

  // Saved searches
  searches: router({
    list: protectedProcedure
      .input(z.object({ page: z.string() }))
      .query(async ({ input, ctx }) => {
        return db.getSavedSearches(ctx.user!.id, input.page);
      }),
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1).max(128),
        page: z.string().min(1),
        conditions: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        return db.createSavedSearch({ ...input, userId: ctx.user!.id });
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteSavedSearch(input.id);
        return { success: true };
      }),
  }),

  // Search suggestions
  suggestions: router({
    get: publicProcedure
      .input(z.object({
        field: z.string(),
        query: z.string(),
        limit: z.number().min(1).max(20).default(10),
      }))
      .query(async ({ input }) => {
        return db.getSearchSuggestions(input.field, input.query, input.limit);
      }),
  }),

  customers: router({
    list: protectedProcedure
      .input(z.object({
        search: z.string().optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
      }))
      .query(async ({ input }) => {
        return db.getCustomerList(input);
      }),
  }),
});

export type AppRouter = typeof appRouter;
