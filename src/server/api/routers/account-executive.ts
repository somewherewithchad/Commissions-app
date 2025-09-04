import {
  createTRPCRouter,
  protectedProcedure,
  createTRPCContext,
} from "@/server/api/trpc";
import { z } from "zod";

export const accountExecutiveRouter = createTRPCRouter({
  // Queries
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
            commissionRate: z.number(),
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

        const emailToNameMap = new Map<string, string>();
        input.invoices.forEach((i) =>
          emailToNameMap.set(i.executiveEmail, i.executiveName)
        );
        input.collections.forEach((c) =>
          emailToNameMap.set(c.executiveEmail, c.executiveName)
        );
        await Promise.all(
          Array.from(emailToNameMap.entries()).map(([email, name]) =>
            tx.accountExecutive.upsert({
              where: { email },
              create: { email, name },
              update: { name },
            })
          )
        );

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
          await tx.accountExecutiveCollection.createMany({
            data: input.collections.map((collection) => ({
              amountPaid: collection.amountPaid,
              month: collection.month,
              dealId: collection.dealId,
              executiveEmail: collection.executiveEmail,
              commissionRate: collection.commissionRate / 100,
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
  const commissionRate = collections[0]?.commissionRate ?? 0;
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
