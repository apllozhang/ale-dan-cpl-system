import { router, superAdminProcedure } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";
import { TRPCError } from "@trpc/server";

export const userGroupsRouter = router({
  list: superAdminProcedure.query(async () => {
    try {
      return await db.getAllUserGroups();
    } catch (error) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch user groups', cause: error });
    }
  }),
  create: superAdminProcedure
    .input(z.object({ name: z.string().min(1).max(128), organizationId: z.number() }))
    .mutation(async ({ input }) => {
      try {
        return await db.createUserGroup(input);
      } catch (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create user group', cause: error });
      }
    }),
  update: superAdminProcedure
    .input(z.object({ id: z.number(), name: z.string().min(1).max(128).optional(), organizationId: z.number().optional() }))
    .mutation(async ({ input }) => {
      try {
        const { id, ...data } = input;
        return await db.updateUserGroup(id, data);
      } catch (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update user group', cause: error });
      }
    }),
  delete: superAdminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      try {
        return await db.deleteUserGroup(input.id);
      } catch (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete user group', cause: error });
      }
    }),
});
