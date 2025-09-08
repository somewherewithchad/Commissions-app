import {
  createTRPCRouter,
  protectedProcedure,
  createTRPCContext,
  adminProcedure,
} from "@/server/api/trpc";
import { z } from "zod";

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

      const affectedHistoricalMonths = new Set<string>();

      await ctx.db.$transaction(async (tx) => {
        await tx.accountExecutiveInvoice.deleteMany({
          where: { month: month },
        });
        await tx.accountExecutiveCollection.deleteMany({
          where: { month: month },
        });

        // Validate that all referenced executives exist
        const referencedEmails = Array.from(
          new Set([
            ...input.invoices.map((i) => i.executiveEmail),
            ...input.collections.map((c) => c.executiveEmail),
          ])
        );
        if (referencedEmails.length > 0) {
          const existing = await tx.accountExecutive.findMany({
            where: { email: { in: referencedEmails } },
            select: { email: true },
          });
          const existingSet = new Set(existing.map((e) => e.email));
          const missing = referencedEmails.filter((e) => !existingSet.has(e));
          if (missing.length > 0) {
            throw new Error(
              `Unknown account executives for this upload: ${missing.join(
                ", "
              )}`
            );
          }
        }

        if (positiveInvoices.length > 0) {
          await tx.accountExecutiveInvoice.createMany({
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
        if (input.collections.length > 0) {
          // Compute per-executive commission rate for this month using tier thresholds
          const totalsByExecutiveEmail = new Map<string, number>();
          for (const c of input.collections) {
            const current = totalsByExecutiveEmail.get(c.executiveEmail) ?? 0;
            totalsByExecutiveEmail.set(
              c.executiveEmail,
              current + c.amountPaid
            );
          }

          const uniqueEmails = Array.from(totalsByExecutiveEmail.keys());
          const executives = await tx.accountExecutive.findMany({
            where: { email: { in: uniqueEmails } },
            select: {
              email: true,
              baseCommissionRate: true,
              tier1CommissionRate: true,
              tier1CashCollectedThreshold: true,
              tier2CommissionRate: true,
              tier2CashCollectedThreshold: true,
              tier3CommissionRate: true,
              tier3CashCollectedThreshold: true,
            },
          });

          const emailToExecutive = new Map(executives.map((e) => [e.email, e]));

          const computeRate = (
            total: number,
            exec: (typeof executives)[number]
          ) => {
            let rate = exec.baseCommissionRate ?? 0;
            if (
              exec.tier1CashCollectedThreshold !== undefined &&
              total >= exec.tier1CashCollectedThreshold
            ) {
              rate = exec.tier1CommissionRate ?? rate;
            }
            if (
              exec.tier2CashCollectedThreshold !== undefined &&
              total >= exec.tier2CashCollectedThreshold
            ) {
              rate = exec.tier2CommissionRate ?? rate;
            }
            if (
              exec.tier3CashCollectedThreshold !== undefined &&
              total >= exec.tier3CashCollectedThreshold
            ) {
              rate = exec.tier3CommissionRate ?? rate;
            }
            return rate;
          };

          const emailToComputedRate = new Map<string, number>();
          for (const email of uniqueEmails) {
            const exec = emailToExecutive.get(email);
            const total = totalsByExecutiveEmail.get(email) ?? 0;
            if (exec) {
              emailToComputedRate.set(email, computeRate(total, exec));
            } else {
              emailToComputedRate.set(email, 0);
            }
          }

          await tx.accountExecutiveCollection.createMany({
            data: input.collections.map((collection) => ({
              amountPaid: collection.amountPaid,
              month: collection.month,
              dealId: collection.dealId,
              executiveEmail: collection.executiveEmail,
              commissionRate:
                emailToComputedRate.get(collection.executiveEmail) ?? 0,
            })),
          });
        }

        for (const adjustment of negativeAdjustments) {
          const originalInvoice = await tx.accountExecutiveInvoice.findUnique({
            where: { dealId: adjustment.dealId },
            select: { month: true },
          });

          if (originalInvoice) {
            affectedHistoricalMonths.add(originalInvoice.month);
            await tx.accountExecutiveInvoice.update({
              where: { dealId: adjustment.dealId },
              data: {
                amountInvoiced: {
                  decrement: Math.abs(adjustment.amountInvoiced),
                },
              },
            });
          } else {
            throw new Error(
              `Adjustment failed: The original deal with ID "${adjustment.dealId}" was not found.`
            );
          }
        }
      });

      // --- FINAL, CORRECT RECALCULATION LOGIC ---
      const allExecutives = await ctx.db.accountExecutive.findMany({
        select: { email: true },
      });

      const monthsToUpdateSummaries = [
        ...new Set([month, ...affectedHistoricalMonths]),
      ];

      for (const executive of allExecutives) {
        // Update summaries for the current month AND any affected historical months.
        for (const m of monthsToUpdateSummaries) {
          await updateAccountExecutiveMonthlySummary(m, executive.email, ctx);
        }
        // But only calculate the payout for the current month of the upload.
        await calculateAccountExecutivePayouts(month, executive.email, ctx);
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
        },
      });
      return {
        success: true,
        message: "Account executive added successfully",
      };
    }),
});

const updateAccountExecutiveMonthlySummary = async (
  month: string,
  executiveEmail: string,
  ctx: Awaited<ReturnType<typeof createTRPCContext>>
) => {
  const invoices = await ctx.db.accountExecutiveInvoice.findMany({
    where: { executiveEmail, month },
  });
  const collections = await ctx.db.accountExecutiveCollection.findMany({
    where: { executiveEmail, month },
  });
  const totalInvoiced = invoices.reduce((acc, i) => acc + i.amountInvoiced, 0);
  const totalCollections = collections.reduce(
    (acc, c) => acc + c.amountPaid,
    0
  );
  // Compute commission rate at runtime from AccountExecutive tier settings
  const exec = await ctx.db.accountExecutive.findUnique({
    where: { email: executiveEmail },
    select: {
      baseCommissionRate: true,
      tier1CommissionRate: true,
      tier1CashCollectedThreshold: true,
      tier2CommissionRate: true,
      tier2CashCollectedThreshold: true,
      tier3CommissionRate: true,
      tier3CashCollectedThreshold: true,
    },
  });
  let commissionRate = 0;
  if (exec) {
    commissionRate = exec.baseCommissionRate ?? 0;
    if (
      exec.tier1CashCollectedThreshold !== undefined &&
      totalCollections >= exec.tier1CashCollectedThreshold
    ) {
      commissionRate = exec.tier1CommissionRate ?? commissionRate;
    }
    if (
      exec.tier2CashCollectedThreshold !== undefined &&
      totalCollections >= exec.tier2CashCollectedThreshold
    ) {
      commissionRate = exec.tier2CommissionRate ?? commissionRate;
    }
    if (
      exec.tier3CashCollectedThreshold !== undefined &&
      totalCollections >= exec.tier3CashCollectedThreshold
    ) {
      commissionRate = exec.tier3CommissionRate ?? commissionRate;
    }
  }
  await ctx.db.accountExecutiveMonthlySummary.upsert({
    where: { executiveEmail_month: { executiveEmail, month } },
    create: {
      month,
      executiveEmail,
      totalInvoiced,
      totalCollections,
      commissionRate,
    },
    update: { totalInvoiced, totalCollections, commissionRate },
  });
};

const calculateAccountExecutivePayouts = async (
  month: string,
  executiveEmail: string,
  ctx: Awaited<ReturnType<typeof createTRPCContext>>
) => {
  const summary = await ctx.db.accountExecutiveMonthlySummary.findUnique({
    where: { executiveEmail_month: { executiveEmail, month } },
  });
  await ctx.db.accountExecutivePayout.deleteMany({
    where: { sourceExecutiveEmail: executiveEmail, sourceSummaryMonth: month },
  });
  if (summary && summary.totalCollections !== 0) {
    await ctx.db.accountExecutivePayout.create({
      data: {
        amount: summary.totalCollections * summary.commissionRate,
        commissionRate: summary.commissionRate,
        payoutMonth: month,
        sourceSummaryMonth: month,
        sourceExecutiveEmail: executiveEmail,
      },
    });
  }
};
