import { router, adminProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { hash } from "bcryptjs";
import { logActivity } from "./helpers";

export const usersRouter = router({
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
      name: z.string().max(256).optional(),
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
      name: z.string().max(256).optional(),
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
});
