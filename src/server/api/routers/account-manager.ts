import {
  createTRPCRouter,
  protectedProcedure,
  createTRPCContext,
  adminProcedure,
} from "@/server/api/trpc";
import { z } from "zod";

export const accountManagerRouter = createTRPCRouter({
  // Queries
  getAllAccountManagers: adminProcedure
    .input(
      z.object({
        page: z.number(),
        perPage: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      const total = await ctx.db.accountManager.count();

      const pageCount = Math.ceil(total / input.perPage);

      const items = await ctx.db.accountManager.findMany({
        take: input.perPage,
        skip: (input.page - 1) * input.perPage,
        include: {
          user: true,
        },
      });

      return {
        items,
        pageCount,
      };
    }),
  // Mutations
  addAccountManager: adminProcedure
    .input(z.object({ email: z.string().email(), name: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return {
        success: true,
        message: "Account manager added successfully",
      };
    }),
});
