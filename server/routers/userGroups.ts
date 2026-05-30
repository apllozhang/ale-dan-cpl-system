import { router, superAdminProcedure } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";

export const userGroupsRouter = router({
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
});
