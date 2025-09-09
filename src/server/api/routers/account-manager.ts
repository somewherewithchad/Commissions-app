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
    .input(
      z.object({
        email: z.string().email(),
        name: z.string(),
        isAmerican: z.boolean(),
        americanCommissionRate: z.number(),
        tier1CommissionRate: z.number(),
        tier1Threshold: z.number(),
        tier2CommissionRate: z.number(),
        tier2Threshold: z.number(),
        tier3CommissionRate: z.number(),
        tier3Threshold: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const user = await ctx.db.user.findUnique({
        where: { email: input.email },
      });

      await ctx.db.accountManager.create({
        data: {
          userId: user?.id,
          email: input.email,
          name: input.name,
          isAmerican: input.isAmerican,
          americanCommissionRate: input.americanCommissionRate / 100,
          tier1CommissionRate: input.tier1CommissionRate / 100,
          tier1Threshold: input.tier1Threshold,
          tier2CommissionRate: input.tier2CommissionRate / 100,
          tier2Threshold: input.tier2Threshold,
          tier3CommissionRate: input.tier3CommissionRate / 100,
          tier3Threshold: input.tier3Threshold,
        },
      });

      return {
        success: true,
        message: "Account manager added successfully",
      };
    }),
  editAccountManager: adminProcedure
    .input(
      z.object({
        email: z.string().email(),
        name: z.string(),
        isAmerican: z.boolean(),
        americanCommissionRate: z.number(),
        tier1CommissionRate: z.number(),
        tier1Threshold: z.number(),
        tier2CommissionRate: z.number(),
        tier2Threshold: z.number(),
        tier3CommissionRate: z.number(),
        tier3Threshold: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await ctx.db.accountManager.update({
        where: { email: input.email },
        data: {
          name: input.name,
          isAmerican: input.isAmerican,
          americanCommissionRate: input.americanCommissionRate / 100,
          tier1CommissionRate: input.tier1CommissionRate / 100,
          tier1Threshold: input.tier1Threshold,
          tier2CommissionRate: input.tier2CommissionRate / 100,
          tier2Threshold: input.tier2Threshold,
          tier3CommissionRate: input.tier3CommissionRate / 100,
          tier3Threshold: input.tier3Threshold,
        },
      });

      return {
        success: true,
        message: "Account manager updated successfully",
      };
    }),
});
