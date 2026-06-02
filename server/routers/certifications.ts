import { router, protectedProcedure, permissionProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import * as XLSX from "xlsx";
import { PERMISSIONS } from "@shared/const";
import { logActivity } from "./helpers";

export const certificationsRouter = router({
  list: protectedProcedure
    .input(z.object({
      certType: z.string().optional(),
      status: z.string().optional(),
      standardType: z.string().optional(),
      keyword: z.string().optional(),
      page: z.number().min(1).default(1),
      pageSize: z.number().min(1).max(100).default(20),
    }))
    .query(async ({ input }) => {
      return db.listCertifications(input);
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const cert = await db.getCertificationById(input.id);
      if (!cert) throw new TRPCError({ code: "NOT_FOUND", message: "Certificate not found" });
      return cert;
    }),

  byProduct: protectedProcedure
    .input(z.object({ productModel: z.string() }))
    .query(async ({ input }) => {
      return db.getCertificationsByProduct(input.productModel);
    }),

  expiring: protectedProcedure
    .input(z.object({ days: z.number().min(1).max(365).default(90) }))
    .query(async ({ input }) => {
      return db.getExpiringCertifications(input.days);
    }),

  export: protectedProcedure
    .input(z.object({
      certType: z.string().optional(),
      status: z.string().optional(),
      standardType: z.string().optional(),
      keyword: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const { items } = await db.listCertifications({ ...input, page: 1, pageSize: 10000 });
      const headers = [
        "证书编号", "证书名称", "认证标准", "认证机构", "持有人",
        "工厂编号", "检测报告编号", "认证范围", "发证日期", "到期日期", "状态", "备注",
      ];
      const rows = items.map((c) => [
        c.certNo, c.certName, c.standardType ?? "", c.issuer, c.holder,
        c.factoryNo ?? "", c.testReportNo ?? "", c.certScope ?? "",
        c.issueDate, c.expiryDate ?? "", c.status, c.remark ?? "",
      ]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "证书清单");
      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      return buffer.toString("base64");
    }),

  create: permissionProcedure(PERMISSIONS.MANAGE_CERTIFICATIONS)
    .input(z.object({
      certType: z.enum(["product", "enterprise"]),
      certNo: z.string().min(1).max(128),
      certName: z.string().min(1).max(256),
      standardType: z.string().max(64).optional(),
      issuer: z.string().min(1).max(256),
      holder: z.string().min(1).max(256),
      factoryNo: z.string().max(128).optional(),
      testReportNo: z.string().max(128).optional(),
      certScope: z.string().optional(),
      issueDate: z.string().min(1).max(10),
      expiryDate: z.string().max(10).optional(),
      status: z.string().default("active"),
      attachmentUrl: z.string().max(512).optional(),
      remark: z.string().optional(),
      productModels: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { productModels, ...certData } = input;
      if (certData.certType === "product" && (!productModels || productModels.length === 0)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "产品认证必须关联至少一个产品型号" });
      }
      const existing = await db.getCertificationByCertNo(certData.certNo);
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: `证书编号 ${certData.certNo} 已存在` });
      }
      const id = await db.createCertification({ ...certData, createdBy: ctx.user.id }, productModels);
      await logActivity(ctx, { action: "create_certification", resourceType: "certification", resourceId: id });
      return { id };
    }),

  update: permissionProcedure(PERMISSIONS.MANAGE_CERTIFICATIONS)
    .input(z.object({
      id: z.number(),
      certType: z.enum(["product", "enterprise"]).optional(),
      certNo: z.string().min(1).max(128).optional(),
      certName: z.string().min(1).max(256).optional(),
      standardType: z.string().max(64).optional(),
      issuer: z.string().min(1).max(256).optional(),
      holder: z.string().min(1).max(256).optional(),
      factoryNo: z.string().max(128).optional(),
      testReportNo: z.string().max(128).optional(),
      certScope: z.string().optional(),
      issueDate: z.string().min(1).max(10).optional(),
      expiryDate: z.string().max(10).optional(),
      status: z.string().optional(),
      attachmentUrl: z.string().max(512).optional(),
      remark: z.string().optional(),
      productModels: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, productModels, ...certData } = input;
      const existing = await db.getCertificationById(id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Certificate not found" });
      if (certData.certNo && certData.certNo !== existing.certNo) {
        const dup = await db.getCertificationByCertNo(certData.certNo);
        if (dup) throw new TRPCError({ code: "CONFLICT", message: `证书编号 ${certData.certNo} 已存在` });
      }
      await db.updateCertification(id, certData, productModels);
      await logActivity(ctx, { action: "update_certification", resourceType: "certification", resourceId: id });
      return { success: true };
    }),

  delete: permissionProcedure(PERMISSIONS.MANAGE_CERTIFICATIONS)
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const existing = await db.getCertificationById(input.id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Certificate not found" });
      await db.deleteCertification(input.id);
      await logActivity(ctx, { action: "delete_certification", resourceType: "certification", resourceId: input.id });
      return { success: true };
    }),

  import: permissionProcedure(PERMISSIONS.MANAGE_CERTIFICATIONS)
    .input(z.object({
      fileBase64: z.string().max(50_000_000),
      certType: z.enum(["product", "enterprise"]),
    }))
    .mutation(async ({ input, ctx }) => {
      const buffer = Buffer.from(input.fileBase64, "base64");
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      if (rows.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Excel 文件为空" });

      const imported: string[] = [];
      const errors: string[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const certNo = (row["证书编号"] ?? "").trim();
        if (!certNo) { errors.push(`第 ${i + 2} 行: 缺少证书编号`); continue; }

        const existing = await db.getCertificationByCertNo(certNo);
        if (existing) { errors.push(`第 ${i + 2} 行: 证书编号 ${certNo} 已存在`); continue; }

        const certData = {
          certType: input.certType,
          certNo,
          certName: (row["证书名称"] ?? "").trim(),
          standardType: (row["认证标准"] ?? "").trim() || null,
          issuer: (row["认证机构"] ?? "").trim(),
          holder: (row["持有人"] ?? "").trim(),
          factoryNo: (row["工厂编号"] ?? "").trim() || null,
          testReportNo: (row["检测报告编号"] ?? "").trim() || null,
          certScope: (row["认证范围"] ?? row["适用范围"] ?? "").trim() || null,
          issueDate: (row["发证日期"] ?? "").trim(),
          expiryDate: (row["到期日期"] ?? "").trim() || null,
          status: "active",
          remark: (row["备注"] ?? "").trim() || null,
          createdBy: ctx.user.id,
        };

        if (!certData.certName || !certData.issuer || !certData.holder || !certData.issueDate) {
          errors.push(`第 ${i + 2} 行: 缺少必填字段（证书名称/认证机构/持有人/发证日期）`);
          continue;
        }

        const modelsStr = (row["关联产品型号"] ?? "").trim();
        const productModels = input.certType === "product" && modelsStr
          ? modelsStr.split(/[,;，；]/).map(s => s.trim()).filter(Boolean)
          : undefined;

        if (input.certType === "product" && (!productModels || productModels.length === 0)) {
          errors.push(`第 ${i + 2} 行: 产品认证缺少关联产品型号`);
          continue;
        }

        await db.createCertification(certData, productModels);
        imported.push(certNo);
      }

      await logActivity(ctx, {
        action: "import_certifications",
        resourceType: "certification",
        detail: { imported: imported.length, failed: errors.length },
      });

      return { imported: imported.length, errors };
    }),
});
