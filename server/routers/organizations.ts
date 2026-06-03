import { router, superAdminProcedure } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";
import { logActivity } from "./helpers";
import { TRPCError } from "@trpc/server";

export const organizationsRouter = router({
  list: superAdminProcedure.query(async () => {
    try {
      return await db.getAllOrganizations();
    } catch (error) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch organizations', cause: error });
    }
  }),
  create: superAdminProcedure
    .input(z.object({ name: z.string().min(1).max(128) }))
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await db.createOrganization(input);
        await logActivity(ctx, { action: "create_organization", resourceType: "organization", detail: { name: input.name } });
        return result;
      } catch (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create organization', cause: error });
      }
    }),
  update: superAdminProcedure
    .input(z.object({ id: z.number(), name: z.string().min(1).max(128) }))
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await db.updateOrganization(input.id, { name: input.name });
        await logActivity(ctx, { action: "update_organization", resourceType: "organization", resourceId: input.id, detail: { name: input.name } });
        return result;
      } catch (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update organization', cause: error });
      }
    }),
  delete: superAdminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      try {
        await logActivity(ctx, { action: "delete_organization", resourceType: "organization", resourceId: input.id, detail: { id: input.id } });
        return await db.deleteOrganization(input.id);
      } catch (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete organization', cause: error });
      }
    }),
});
