import { lastLockedMonth } from "@/lib/utils";
import {
  createTRPCRouter,
  protectedProcedure,
  adminProcedure,
} from "@/server/api/trpc";
import { z } from "zod";
import { customAlphabet } from "nanoid";
const nanoid = customAlphabet("1234567890abcdefghijklmnopqrstuvwxyz", 6);

export const accountExecutiveRouter = createTRPCRouter({
  // Queries
  getAllAccountExecutives: adminProcedure
    .input(
      z.object({
        page: z.number(),
        perPage: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      const total = await ctx.db.accountExecutive.count();

      const pageCount = Math.ceil(total / input.perPage);

      const items = await ctx.db.accountExecutive.findMany({
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
  getExecutiveData: protectedProcedure
    .input(z.object({ year: z.string().regex(/^\d{4}$/) }))
    .query(async ({ ctx, input }) => {
      const executiveEmail = ctx.session.user.email;

      const summaries = await ctx.db.accountExecutiveMonthlySummary.findMany({
        where: { executiveEmail, month: { startsWith: input.year } },
      });
      const payouts = await ctx.db.accountExecutivePayout.findMany({
        where: {
          sourceExecutiveEmail: executiveEmail,
          payoutMonth: { startsWith: input.year },
        },
      });

      const summaryMap = new Map(summaries.map((s) => [s.month, s]));
      const payoutMap = new Map<string, number>();
      for (const p of payouts) {
        payoutMap.set(
          p.payoutMonth,
          (payoutMap.get(p.payoutMonth) ?? 0) + p.amount
        );
      }

      const results = Array.from({ length: 12 }, (_, i) => {
        const month = `${input.year}-${String(i + 1).padStart(2, "0")}`;
        const summary = summaryMap.get(month) ?? {
          totalInvoiced: 0,
          totalCollections: 0,
        };
        const totalPayout = payoutMap.get(month) ?? 0;
        return {
          month,
          totalInvoiced: summary.totalInvoiced,
          totalCollections: summary.totalCollections,
          totalPayout,
        };
      });

      return results;
    }),
  getExecutiveMonthDetails: protectedProcedure
    .input(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }))
    .query(async ({ ctx, input }) => {
      const executiveEmail = ctx.session.user.email;

      const payouts = await ctx.db.accountExecutivePayout.findMany({
        where: {
          sourceExecutiveEmail: executiveEmail,
          payoutMonth: input.month,
        },
        orderBy: { amount: "desc" },
      });

      const enriched = await Promise.all(
        payouts.map(async (p) => {
          const collections = await ctx.db.accountExecutiveCollection.findMany({
            where: { executiveEmail, month: p.sourceSummaryMonth },
            orderBy: { amountPaid: "desc" },
          });
          const dealIds = [...new Set(collections.map((c) => c.dealId))];
          const invoices = await ctx.db.accountExecutiveInvoice.findMany({
            where: { executiveEmail, dealId: { in: dealIds } },
          });
          const dealMap = new Map(invoices.map((inv) => [inv.dealId, inv]));
          const sourceCollections = collections.map((c) => ({
            id: c.id,
            dealId: c.dealId,
            dealName: dealMap.get(c.dealId)?.dealName ?? null,
            dealLink: dealMap.get(c.dealId)?.dealLink ?? null,
            amountPaid: c.amountPaid,
          }));
          return {
            ...p,
            type: "base" as const,
            commissionRate: p.commissionRate,
            sourceCollections,
          };
        })
      );

      return { payouts: enriched } as const;
    }),
  getPayoutsByMonth: protectedProcedure
    .input(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }))
    .query(async ({ ctx, input }) => {
      if (ctx.session?.user?.role !== "admin") {
        throw new Error("Not authorized");
      }

      const payouts = await ctx.db.accountExecutivePayout.findMany({
        where: { payoutMonth: input.month },
        orderBy: { amount: "desc" },
      });
      if (payouts.length === 0) return [] as const;

      const emails = [...new Set(payouts.map((p) => p.sourceExecutiveEmail))];
      const sourceMonths = [
        ...new Set(payouts.map((p) => p.sourceSummaryMonth)),
      ];
      const executives = await ctx.db.accountExecutive.findMany({
        where: { email: { in: emails } },
      });
      const emailToExec = new Map(executives.map((e) => [e.email, e]));

      const allCollections = await ctx.db.accountExecutiveCollection.findMany({
        where: { executiveEmail: { in: emails }, month: { in: sourceMonths } },
      });
      const collectionsByKey = new Map<string, typeof allCollections>();
      const keyFor = (email: string, month: string) => `${email}__${month}`;
      for (const c of allCollections) {
        const k = keyFor(c.executiveEmail, c.month);
        const list = collectionsByKey.get(k);
        if (list) list.push(c);
        else collectionsByKey.set(k, [c]);
      }

      const allDealIds = [...new Set(allCollections.map((c) => c.dealId))];
      const invoices = await ctx.db.accountExecutiveInvoice.findMany({
        where: { executiveEmail: { in: emails }, dealId: { in: allDealIds } },
      });
      const dealIdToInvoice = new Map(invoices.map((inv) => [inv.dealId, inv]));

      const results = payouts.map((p) => {
        const cols =
          collectionsByKey.get(
            keyFor(p.sourceExecutiveEmail, p.sourceSummaryMonth)
          ) ?? [];
        const sourceCollections = cols.map((c) => ({
          id: c.id,
          dealId: c.dealId,
          dealName: dealIdToInvoice.get(c.dealId)?.dealName ?? null,
          dealLink: dealIdToInvoice.get(c.dealId)?.dealLink ?? null,
          amountPaid: c.amountPaid,
        }));
        return {
          ...p,
          executiveName: emailToExec.get(p.sourceExecutiveEmail)?.name ?? null,
          sourceCollections,
        } as const;
      });

      return results;
    }),
  addMonthlyData: protectedProcedure
    .input(
      z.object({
        invoices: z.array(
          z.object({
            dealId: z.string(),
            dealLink: z.string().optional(),
            dealName: z.string(),
            executiveName: z.string(),
            executiveEmail: z.string().email(),
            amountInvoiced: z.number(),
            month: z.string().regex(/^\d{4}-\d{2}$/),
          })
        ),
        collections: z.array(
          z.object({
            dealId: z.string(),
            executiveName: z.string(),
            executiveEmail: z.string().email(),
            amountPaid: z.number(),
            month: z.string().regex(/^\d{4}-\d{2}$/),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const existingData = await ctx.db.accountExecutiveInvoice.findMany({
        where: {
          month: { in: input.invoices.map((i) => i.month) },
        },
      });
      if (existingData.length > 0) {
        throw new Error("Data for this month has already been uploaded.");
      }

      const allMonths = new Set([
        ...input.invoices.map((i) => i.month),
        ...input.collections.map((c) => c.month),
      ]);
      if (allMonths.size > 1) {
        throw new Error(
          "Data for multiple months was found in a single upload. Please upload data for one month at a time."
        );
      }

      const month = allMonths.values().next().value;
      if (!month) {
        return { success: true, message: "No data to process." };
      }

      const positiveInvoices = input.invoices.filter(
        (i) => i.amountInvoiced >= 0
      );
      const negativeAdjustments = input.invoices.filter(
        (i) => i.amountInvoiced < 0
      );

      await ctx.db.accountExecutiveInvoice.deleteMany({
        where: { month: month },
      });
      await ctx.db.accountExecutiveCollection.deleteMany({
        where: { month: month },
      });

      const referencedEmails = Array.from(
        new Set([
          ...input.invoices.map((i) => i.executiveEmail),
          ...input.collections.map((c) => c.executiveEmail),
        ])
      );
      if (referencedEmails.length > 0) {
        const existing = await ctx.db.accountExecutive.findMany({
          where: { email: { in: referencedEmails } },
          select: { email: true },
        });
        const existingSet = new Set(existing.map((e) => e.email));
        const missing = referencedEmails.filter((e) => !existingSet.has(e));
        if (missing.length > 0) {
          throw new Error(
            `Unknown account executives for this upload: ${missing.join(", ")}`
          );
        }
      }

      if (positiveInvoices.length > 0) {
        await ctx.db.accountExecutiveInvoice.createMany({
          data: positiveInvoices.map((invoice) => ({
            dealId: invoice.dealId,
            dealLink: invoice.dealLink,
            dealName: invoice.dealName,
            amountInvoiced: invoice.amountInvoiced,
            month: invoice.month,
            executiveEmail: invoice.executiveEmail,
          })),
        });
      }
      if (negativeAdjustments.length > 0) {
        await ctx.db.accountExecutiveInvoice.createMany({
          data: negativeAdjustments.map((adjustment) => ({
            dealId: `${adjustment.dealId}-${nanoid()}`,
            dealLink: adjustment.dealLink,
            dealName: adjustment.dealName,
            amountInvoiced: adjustment.amountInvoiced,
            month: adjustment.month,
            executiveEmail: adjustment.executiveEmail,
          })),
        });
      }
      if (input.collections.length > 0) {
        await ctx.db.accountExecutiveCollection.createMany({
          data: input.collections.map((collection) => ({
            amountPaid: collection.amountPaid,
            month: collection.month,
            dealId: collection.dealId,
            executiveEmail: collection.executiveEmail,
          })),
        });
      }

      const uniqueExecutives = Array.from(
        new Set(input.collections.map((c) => c.executiveEmail))
      );
      for (const executive of uniqueExecutives) {
        const totalInvoiced = input.invoices
          .filter((i) => i.month === month && i.executiveEmail === executive)
          .reduce((acc, i) => acc + i.amountInvoiced, 0);
        const totalCollections = input.collections
          .filter((c) => c.month === month && c.executiveEmail === executive)
          .reduce((acc, c) => acc + c.amountPaid, 0);

        await ctx.db.accountExecutiveMonthlySummary.create({
          data: {
            month: month,
            executiveEmail: executive,
            totalInvoiced: totalInvoiced,
            totalCollections: totalCollections,
          },
        });

        const executiveFromDb = await ctx.db.accountExecutive.findUnique({
          where: { email: executive },
        });
        const commissionRate = getCommissionRate(
          totalCollections,
          executiveFromDb
        );

        await ctx.db.accountExecutivePayout.create({
          data: {
            amount: totalCollections * commissionRate,
            commissionRate: commissionRate,
            payoutMonth: month,
            sourceSummaryMonth: month,
            sourceExecutiveEmail: executive,
          },
        });
      }

      return {
        success: true,
        message: "Monthly data added successfully",
      };
    }),
  // Mutations
  addAccountExecutive: adminProcedure
    .input(
      z.object({
        email: z.string().email(),
        name: z.string(),
        baseCommissionRate: z.number(),
        tier1CommissionRate: z.number(),
        tier1CashCollectedThreshold: z.number(),
        tier2CommissionRate: z.number(),
        tier2CashCollectedThreshold: z.number(),
        tier3CommissionRate: z.number(),
        tier3CashCollectedThreshold: z.number(),
        tierSystemEnabled: z.boolean(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const user = await ctx.db.user.findUnique({
        where: { email: input.email },
      });

      await ctx.db.accountExecutive.create({
        data: {
          userId: user?.id,
          email: input.email,
          name: input.name,
          baseCommissionRate: input.baseCommissionRate / 100,
          tier1CommissionRate: input.tier1CommissionRate / 100,
          tier1CashCollectedThreshold: input.tier1CashCollectedThreshold,
          tier2CommissionRate: input.tier2CommissionRate / 100,
          tier2CashCollectedThreshold: input.tier2CashCollectedThreshold,
          tier3CommissionRate: input.tier3CommissionRate / 100,
          tier3CashCollectedThreshold: input.tier3CashCollectedThreshold,
          tierSystemEnabled: input.tierSystemEnabled,
        },
      });
      return {
        success: true,
        message: "Account executive added successfully",
      };
    }),
  editAccountExecutive: adminProcedure
    .input(
      z.object({
        email: z.string().email(),
        name: z.string(),
        baseCommissionRate: z.number(),
        tier1CommissionRate: z.number(),
        tier1CashCollectedThreshold: z.number(),
        tier2CommissionRate: z.number(),
        tier2CashCollectedThreshold: z.number(),
        tier3CommissionRate: z.number(),
        tier3CashCollectedThreshold: z.number(),
        tierSystemEnabled: z.boolean(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await ctx.db.accountExecutive.update({
        where: { email: input.email },
        data: {
          name: input.name,
          baseCommissionRate: input.baseCommissionRate / 100,
          tier1CommissionRate: input.tier1CommissionRate / 100,
          tier1CashCollectedThreshold: input.tier1CashCollectedThreshold,
          tier2CommissionRate: input.tier2CommissionRate / 100,
          tier2CashCollectedThreshold: input.tier2CashCollectedThreshold,
          tier3CommissionRate: input.tier3CommissionRate / 100,
          tier3CashCollectedThreshold: input.tier3CashCollectedThreshold,
          tierSystemEnabled: input.tierSystemEnabled,
        },
      });

      return {
        success: true,
        message: "Account executive updated successfully",
      };
    }),
  deleteDataUptoLockedMonth: adminProcedure.mutation(async ({ ctx }) => {
    const startMonth = lastLockedMonth;

    await ctx.db.$transaction(async (tx) => {
      await tx.accountExecutiveInvoice.deleteMany({
        where: { month: { gte: startMonth } },
      });
      await tx.accountExecutiveCollection.deleteMany({
        where: { month: { gte: startMonth } },
      });
      await tx.accountExecutiveMonthlySummary.deleteMany({
        where: { month: { gte: startMonth } },
      });
      await tx.accountExecutivePayout.deleteMany({
        where: { payoutMonth: { gte: startMonth } },
      });
    });

    return { success: true, message: "Data deleted successfully" };
  }),
});

const getCommissionRate = (
  total: number,
  executive: {
    name: string;
    id: string;
    email: string;
    userId: string | null;
    baseCommissionRate: number;
    tier1CommissionRate: number;
    tier1CashCollectedThreshold: number;
    tier2CommissionRate: number;
    tier2CashCollectedThreshold: number;
    tier3CommissionRate: number;
    tier3CashCollectedThreshold: number;
    tierSystemEnabled: boolean;
  } | null
) => {
  if (!executive) {
    return 0;
  }
  let rate = executive.baseCommissionRate ?? 0;
  if (!executive.tierSystemEnabled) {
    return rate;
  }
  if (
    executive.tier1CashCollectedThreshold !== undefined &&
    total >= executive.tier1CashCollectedThreshold
  ) {
    rate = executive.tier1CommissionRate ?? rate;
  }
  if (
    executive.tier2CashCollectedThreshold !== undefined &&
    total >= executive.tier2CashCollectedThreshold
  ) {
    rate = executive.tier2CommissionRate ?? rate;
  }
  if (
    executive.tier3CashCollectedThreshold !== undefined &&
    total >= executive.tier3CashCollectedThreshold
  ) {
    rate = executive.tier3CommissionRate ?? rate;
  }
  return rate;
};
