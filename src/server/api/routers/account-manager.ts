import {
  createTRPCRouter,
  protectedProcedure,
  createTRPCContext,
  adminProcedure,
} from "@/server/api/trpc";
import { z } from "zod";
import { lastLockedMonth } from "@/lib/utils";
import { addMonths, format, parse } from "date-fns";

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
  addMonthlyData: adminProcedure
    .input(
      z.object({
        invoices: z.array(
          z.object({
            dealId: z.string(),
            dealLink: z.string().optional(),
            dealName: z.string(),
            accountManagerName: z.string(),
            accountManagerEmail: z.string().email(),
            amountInvoiced: z.number(),
            month: z.string().regex(/^\d{4}-\d{2}$/),
            isDealOwner: z.boolean(),
          })
        ),
        collections: z.array(
          z.object({
            dealId: z.string(),
            accountManagerName: z.string(),
            accountManagerEmail: z.string().email(),
            amountPaid: z.number(),
            month: z.string().regex(/^\d{4}-\d{2}$/),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const existingData = await ctx.db.accountManagerInvoice.findMany({
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

      await ctx.db.$transaction(async (tx) => {
        await tx.accountManagerInvoice.deleteMany({
          where: { month: month },
        });
        await tx.accountManagerCollection.deleteMany({
          where: { month: month },
        });

        // Validate that all referenced account managers exist
        const referencedEmails = Array.from(
          new Set([
            ...input.invoices.map((i) => i.accountManagerEmail),
            ...input.collections.map((c) => c.accountManagerEmail),
          ])
        );
        if (referencedEmails.length > 0) {
          const existing = await tx.accountManager.findMany({
            where: { email: { in: referencedEmails } },
            select: { email: true },
          });
          const existingSet = new Set(existing.map((e) => e.email));
          const missing = referencedEmails.filter((e) => !existingSet.has(e));
          if (missing.length > 0) {
            throw new Error(
              `Unknown account managers for this upload: ${missing.join(", ")}`
            );
          }
        }

        if (positiveInvoices.length > 0) {
          await tx.accountManagerInvoice.createMany({
            data: positiveInvoices.map((invoice) => ({
              dealId: invoice.dealId,
              dealLink: invoice.dealLink,
              dealName: invoice.dealName,
              amountInvoiced: invoice.amountInvoiced,
              month: invoice.month,
              isDealOwner: invoice.isDealOwner,
              accountManagerEmail: invoice.accountManagerEmail,
            })),
          });
        }
        if (input.collections.length > 0) {
          await tx.accountManagerCollection.createMany({
            data: input.collections.map((collection) => ({
              dealId: collection.dealId,
              amountPaid: collection.amountPaid,
              month: collection.month,
              accountManagerEmail: collection.accountManagerEmail,
            })),
          });
        }

        for (const adjustment of negativeAdjustments) {
          try {
            await tx.accountManagerInvoice.update({
              where: { dealId: adjustment.dealId },
              data: {
                amountInvoiced: {
                  decrement: Math.abs(adjustment.amountInvoiced),
                },
              },
            });
          } catch (error) {
            continue;
          }
        }
      });

      // Recalculate summaries and payouts from locked month to the uploaded month for ALL managers
      const allManagers = await ctx.db.accountManager.findMany({
        select: { email: true },
      });

      const startMonth = lastLockedMonth;
      const endMonth = month as string;
      const monthsToProcess: string[] = [];
      for (
        let m = startMonth;
        m <= endMonth;
        m = format(addMonths(parse(m, "yyyy-MM", new Date()), 1), "yyyy-MM")
      ) {
        monthsToProcess.push(m);
      }

      for (const manager of allManagers) {
        for (const m of monthsToProcess) {
          await updateAccountManagerMonthlySummary(m, manager.email, ctx);
        }
      }
      for (const manager of allManagers) {
        for (const m of monthsToProcess) {
          await calculateAccountManagerPayouts(m, manager.email, ctx);
        }
      }

      return {
        success: true,
        message: "Monthly data processed successfully",
      };
    }),
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
  deleteDataUptoLockedMonth: adminProcedure.mutation(async ({ ctx }) => {
    const startMonth = lastLockedMonth;

    await ctx.db.$transaction(async (tx) => {
      await tx.accountManagerInvoice.deleteMany({
        where: { month: { gte: startMonth } },
      });
      await tx.accountManagerCollection.deleteMany({
        where: { month: { gte: startMonth } },
      });
      await tx.accountManagerMonthlySummary.deleteMany({
        where: { month: { gte: startMonth } },
      });
      await tx.accountManagerPayout.deleteMany({
        where: { payoutMonth: { gte: startMonth } },
      });
    });

    return {
      success: true,
      message: "Data deleted successfully",
    };
  }),
});

const updateAccountManagerMonthlySummary = async (
  month: string,
  accountManagerEmail: string,
  ctx: Awaited<ReturnType<typeof createTRPCContext>>
) => {
  const invoiceAgg = await ctx.db.accountManagerInvoice.aggregate({
    _sum: { amountInvoiced: true },
    where: { accountManagerEmail, month },
  });
  const collectionAgg = await ctx.db.accountManagerCollection.aggregate({
    _sum: { amountPaid: true },
    where: { accountManagerEmail, month },
  });

  const totalInvoiced = invoiceAgg._sum.amountInvoiced ?? 0;
  const totalCollections = collectionAgg._sum.amountPaid ?? 0;

  await ctx.db.accountManagerMonthlySummary.upsert({
    where: { accountManagerEmail_month: { accountManagerEmail, month } },
    create: { month, accountManagerEmail, totalInvoiced, totalCollections },
    update: { totalInvoiced, totalCollections },
  });
};

const calculateAccountManagerPayouts = async (
  month: string,
  accountManagerEmail: string,
  ctx: Awaited<ReturnType<typeof createTRPCContext>>
) => {
  // Clear existing payouts for this source month
  await ctx.db.accountManagerPayout.deleteMany({
    where: {
      sourceAccountManagerEmail: accountManagerEmail,
      sourceSummaryMonth: month,
    },
  });

  const manager = await ctx.db.accountManager.findUnique({
    where: { email: accountManagerEmail },
  });
  if (!manager) return;

  const collections = await ctx.db.accountManagerCollection.findMany({
    where: { accountManagerEmail, month },
  });
  if (collections.length === 0) return;

  const dealIds = [...new Set(collections.map((c) => c.dealId))];
  const invoices = await ctx.db.accountManagerInvoice.findMany({
    where: { dealId: { in: dealIds }, accountManagerEmail },
  });
  const dealIdToInvoice = new Map(invoices.map((inv) => [inv.dealId, inv]));

  // Prefetch monthly summaries for invoice months to determine tiers for non-Americans
  const invoiceMonths = [...new Set(invoices.map((inv) => inv.month))];
  const monthlySummaries = await ctx.db.accountManagerMonthlySummary.findMany({
    where: { accountManagerEmail, month: { in: invoiceMonths } },
  });
  const monthToInvoiceTotal = new Map(
    monthlySummaries.map((s) => [s.month, s.totalInvoiced])
  );

  const delayedPayoutMonth = (m: string) =>
    format(addMonths(parse(m, "yyyy-MM", new Date()), 1), "yyyy-MM");

  for (const c of collections) {
    const inv = dealIdToInvoice.get(c.dealId);
    if (!inv) continue;

    const isDealOwner = !!inv.isDealOwner;

    if (manager.isAmerican) {
      const baseRate = manager.americanCommissionRate ?? 0;
      if (c.amountPaid > 0 && baseRate > 0) {
        await ctx.db.accountManagerPayout.create({
          data: {
            amount: c.amountPaid * baseRate,
            commissionRate: baseRate,
            payoutMonth: month,
            sourceSummaryMonth: month,
            sourceAccountManagerEmail: accountManagerEmail,
            isDealOwnerBonus: false,
          },
        });
      }
      if (isDealOwner && c.amountPaid > 0) {
        await ctx.db.accountManagerPayout.create({
          data: {
            amount: c.amountPaid * 0.01,
            commissionRate: 0.01,
            payoutMonth: month,
            sourceSummaryMonth: month,
            sourceAccountManagerEmail: accountManagerEmail,
            isDealOwnerBonus: true,
          },
        });
      }
    } else {
      const totalInvForInvoiceMonth = monthToInvoiceTotal.get(inv.month) ?? 0;

      const tier1Rate = manager.tier1CommissionRate ?? 0;
      const tier2Rate = manager.tier2CommissionRate ?? 0;
      const tier3Rate = manager.tier3CommissionRate ?? 0;

      const t1 = manager.tier1Threshold ?? 0;
      const t2 = manager.tier2Threshold ?? 0;

      // Base: always pay tier1 in current month
      if (c.amountPaid > 0 && tier1Rate > 0) {
        await ctx.db.accountManagerPayout.create({
          data: {
            amount: c.amountPaid * tier1Rate,
            commissionRate: tier1Rate,
            payoutMonth: month,
            sourceSummaryMonth: month,
            sourceAccountManagerEmail: accountManagerEmail,
            isDealOwnerBonus: false,
          },
        });
      }
      // Deal owner bonus on top, current month
      if (isDealOwner && c.amountPaid > 0) {
        await ctx.db.accountManagerPayout.create({
          data: {
            amount: c.amountPaid * 0.01,
            commissionRate: 0.01,
            payoutMonth: month,
            sourceSummaryMonth: month,
            sourceAccountManagerEmail: accountManagerEmail,
            isDealOwnerBonus: true,
          },
        });
      }

      // If invoice-month totals cross higher thresholds, pay additional tiers next month
      if (totalInvForInvoiceMonth >= t1 && totalInvForInvoiceMonth < t2) {
        if (c.amountPaid > 0 && tier2Rate > 0) {
          await ctx.db.accountManagerPayout.create({
            data: {
              amount: c.amountPaid * tier2Rate,
              commissionRate: tier2Rate,
              payoutMonth: delayedPayoutMonth(month),
              sourceSummaryMonth: month,
              sourceAccountManagerEmail: accountManagerEmail,
              isDealOwnerBonus: false,
            },
          });
        }
      }
      if (totalInvForInvoiceMonth >= t2) {
        if (c.amountPaid > 0) {
          if (tier2Rate > 0) {
            await ctx.db.accountManagerPayout.create({
              data: {
                amount: c.amountPaid * tier2Rate,
                commissionRate: tier2Rate,
                payoutMonth: delayedPayoutMonth(month),
                sourceSummaryMonth: month,
                sourceAccountManagerEmail: accountManagerEmail,
                isDealOwnerBonus: false,
              },
            });
          }
          if (tier3Rate > 0) {
            await ctx.db.accountManagerPayout.create({
              data: {
                amount: c.amountPaid * tier3Rate,
                commissionRate: tier3Rate,
                payoutMonth: delayedPayoutMonth(month),
                sourceSummaryMonth: month,
                sourceAccountManagerEmail: accountManagerEmail,
                isDealOwnerBonus: false,
              },
            });
          }
        }
      }
    }
  }
};
