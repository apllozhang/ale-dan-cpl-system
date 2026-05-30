import { router, superAdminProcedure } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";
import { logActivity } from "./helpers";

export const organizationsRouter = router({
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
});
