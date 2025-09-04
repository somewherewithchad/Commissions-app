import { createTRPCRouter, createTRPCContext } from "@/server/api/trpc";
import { z } from "zod";
import { protectedProcedure, publicProcedure } from "@/server/api/trpc";
import { addMonths, format, parse, subMonths } from "date-fns";
import { Prisma } from "@prisma/client";

export const recruiterRouter = createTRPCRouter({
  // Queries
  getRecruiterData: protectedProcedure
    .input(
      z.object({
        // Year e.g. "2025"
        year: z.string().regex(/^\d{4}$/),
      })
    )
    .query(async ({ ctx, input }) => {
      const recruiterEmail = ctx.session.user.email;

      const existingSummaries = await ctx.db.recruiterMonthlySummary.findMany({
        where: {
          recruiterEmail,
          month: {
            startsWith: `${input.year}-`,
          },
        },
      });

      const monthToSummary = new Map<
        string,
        (typeof existingSummaries)[number]
      >();
      for (const summary of existingSummaries) {
        monthToSummary.set(summary.month, summary);
      }

      const filledSummaries: typeof existingSummaries = [];
      for (let m = 1; m <= 12; m++) {
        const monthString = `${input.year}-${String(m).padStart(2, "0")}`;
        const existing = monthToSummary.get(monthString);
        if (existing) {
          filledSummaries.push(existing);
        } else {
          filledSummaries.push({
            id: `placeholder-${recruiterEmail}-${monthString}`,
            month: monthString,
            recruiterEmail,
            totalCashCollected: 0,
            totalDealsCompleted: 0,
          } as any);
        }
      }

      const results: Array<{
        month: string;
        totalInvoiced: number;
        totalCollections: number;
        totalPayout: number;
      }> = [];

      for (const summary of filledSummaries) {
        const currentMonthPayouts = await ctx.db.recruiterPayout.findMany({
          where: {
            sourceRecruiterEmail: recruiterEmail,
            sourceSummaryMonth: summary.month,
            payoutMonth: summary.month,
          },
        });
        const currentMonthPayoutTotal = currentMonthPayouts.reduce(
          (acc, p) => acc + p.amount,
          0
        );

        const delayedPayoutMonthString = format(
          subMonths(parse(summary.month, "yyyy-MM", new Date()), 1),
          "yyyy-MM"
        );

        const delayedPayouts = await ctx.db.recruiterPayout.findMany({
          where: {
            sourceRecruiterEmail: recruiterEmail,
            sourceSummaryMonth: delayedPayoutMonthString,
            payoutMonth: summary.month,
          },
        });

        const delayedPayoutTotal = delayedPayouts.reduce(
          (acc, p) => acc + p.amount,
          0
        );

        const allPayoutsForMonth = await ctx.db.recruiterPayout.findMany({
          where: {
            sourceRecruiterEmail: recruiterEmail,
            payoutMonth: summary.month,
          },
        });

        const totalPayout = allPayoutsForMonth.reduce(
          (acc, p) => acc + p.amount,
          0
        );

        results.push({
          month: summary.month,
          totalInvoiced: summary.totalDealsCompleted,
          totalCollections: summary.totalCashCollected,
          totalPayout,
        });
      }

      return results;
    }),
  getRecruiterMonthDetails: protectedProcedure
    .input(
      z.object({
        month: z.string().regex(/^\d{4}-\d{2}$/),
      })
    )
    .query(async ({ ctx, input }) => {
      const recruiterEmail = ctx.session.user.email;

      // Deals completed in the selected month
      const dealsRaw = await ctx.db.recruiterInvoice.findMany({
        where: { recruiterEmail, month: input.month },
        orderBy: { amountInvoiced: "desc" },
      });
      // return all columns except month
      const deals = dealsRaw.map(({ month: _omitted, ...rest }) => rest);

      // Cash collected in the selected month (enrich with deal name/link when possible)
      const cashCollectionsRaw = await ctx.db.recruiterCollection.findMany({
        where: { recruiterEmail, month: input.month },
        orderBy: { amountPaid: "desc" },
      });

      const dealIdsForSelectedMonth = Array.from(
        new Set(cashCollectionsRaw.map((c) => c.dealId))
      );
      const dealsForSelectedMonthIds = await ctx.db.recruiterInvoice.findMany({
        where: { recruiterEmail, dealId: { in: dealIdsForSelectedMonth } },
      });
      const dealIdToDeal = new Map(
        dealsForSelectedMonthIds.map((d) => [d.dealId, d])
      );
      const cashCollections = cashCollectionsRaw.map((c) => {
        const { month: _omitted, ...rest } = c;
        return {
          ...rest,
          dealName: dealIdToDeal.get(c.dealId)?.dealName ?? null,
          dealLink: dealIdToDeal.get(c.dealId)?.dealLink ?? null,
        };
      });

      // Payouts paid in the selected month
      const payoutsRaw = await ctx.db.recruiterPayout.findMany({
        where: {
          sourceRecruiterEmail: recruiterEmail,
          payoutMonth: input.month,
        },
        orderBy: { amount: "desc" },
      });

      // For each payout, include the cash collections from its source month (enriched)
      const payouts = await Promise.all(
        payoutsRaw.map(async (p) => {
          const sourceCash = await ctx.db.recruiterCollection.findMany({
            where: {
              recruiterEmail,
              month: p.sourceSummaryMonth,
            },
            orderBy: { amountPaid: "desc" },
          });
          const sourceDealIds = Array.from(
            new Set(sourceCash.map((c) => c.dealId))
          );
          const sourceDeals = await ctx.db.recruiterInvoice.findMany({
            where: { recruiterEmail, dealId: { in: sourceDealIds } },
          });
          const sourceDealIdToDeal = new Map(
            sourceDeals.map((d) => [d.dealId, d])
          );
          const sourceCashCollections = sourceCash.map((c) => {
            const { month: _omitted, ...rest } = c;
            return {
              ...rest,
              dealName: sourceDealIdToDeal.get(c.dealId)?.dealName ?? null,
              dealLink: sourceDealIdToDeal.get(c.dealId)?.dealLink ?? null,
            };
          });

          return {
            ...p,
            sourceCashCollections,
          } as const;
        })
      );

      return {
        month: input.month,
        deals,
        cashCollections,
        payouts,
      };
    }),
  getPayoutsByMonth: protectedProcedure
    .input(
      z.object({
        month: z.string().regex(/^\d{4}-\d{2}$/),
      })
    )
    .query(async ({ ctx, input }) => {
      if (ctx.session?.user?.role !== "admin") {
        throw new Error("Not authorized");
      }

      const payoutsRaw = await ctx.db.recruiterPayout.findMany({
        where: { payoutMonth: input.month },
        orderBy: { amount: "desc" },
      });

      if (payoutsRaw.length === 0) return [] as const;

      const uniqueEmails = Array.from(
        new Set(payoutsRaw.map((p) => p.sourceRecruiterEmail))
      );
      const uniqueSourceMonths = Array.from(
        new Set(payoutsRaw.map((p) => p.sourceSummaryMonth))
      );

      const recruiters = await ctx.db.recruiter.findMany({
        where: { email: { in: uniqueEmails } },
      });
      const emailToRecruiter = new Map(recruiters.map((r) => [r.email, r]));

      const allCashCollections = await ctx.db.recruiterCollection.findMany({
        where: {
          recruiterEmail: { in: uniqueEmails },
          month: { in: uniqueSourceMonths },
        },
      });

      const keyFor = (email: string, month: string) => `${email}__${month}`;
      const cashByEmailMonth = new Map<string, typeof allCashCollections>();
      for (const c of allCashCollections) {
        const k = keyFor(c.recruiterEmail, c.month);
        const list = cashByEmailMonth.get(k);
        if (list) list.push(c);
        else cashByEmailMonth.set(k, [c]);
      }

      const allDealIds = Array.from(
        new Set(allCashCollections.map((c) => c.dealId))
      );
      const relatedDeals = await ctx.db.recruiterInvoice.findMany({
        where: {
          recruiterEmail: { in: uniqueEmails },
          dealId: { in: allDealIds },
        },
      });
      const dealIdToDeal = new Map(relatedDeals.map((d) => [d.dealId, d]));

      const results = payoutsRaw.map((p) => {
        const recruiter = emailToRecruiter.get(p.sourceRecruiterEmail);
        const sourceCash =
          cashByEmailMonth.get(
            keyFor(p.sourceRecruiterEmail, p.sourceSummaryMonth)
          ) ?? [];
        const sourceCashCollections = sourceCash.map((c) => {
          const { month: _omitted, ...rest } = c as any;
          return {
            ...rest,
            dealName: dealIdToDeal.get(c.dealId)?.dealName ?? null,
            dealLink: dealIdToDeal.get(c.dealId)?.dealLink ?? null,
          };
        });

        return {
          ...p,
          recruiterName: recruiter?.name ?? null,
          sourceCashCollections,
        } as const;
      });

      return results;
    }),
  // Mutations
  addMonthlyData: publicProcedure
    .input(
      z.object({
        deals: z.array(
          z.object({
            dealId: z.string(),
            dealLink: z.string(),
            dealName: z.string(),
            amountInvoiced: z.number(),
            month: z.string(),
            recruiterEmail: z.string(),
            recruiterName: z.string(),
          })
        ),
        cashCollections: z.array(
          z.object({
            dealId: z.string(),
            amountPaid: z.number(),
            month: z.string(),
            recruiterEmail: z.string(),
            recruiterName: z.string(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const allMonths = new Set([
        ...input.deals.map((d) => d.month),
        ...input.cashCollections.map((c) => c.month),
      ]);
      if (allMonths.size > 1) {
        throw new Error(
          "Data for multiple months was found in a single upload. Please upload data for one month at a time."
        );
      }

      const month = allMonths.values().next().value;
      if (!month || typeof month !== "string" || !/^\d{4}-\d{2}$/.test(month)) {
        return {
          success: true,
          message: "No valid data or month found to process.",
        };
      }

      const positiveDeals = input.deals.filter((d) => d.amountInvoiced >= 0);
      const negativeAdjustments = input.deals.filter(
        (d) => d.amountInvoiced < 0
      );
      let recalculationStartMonth = month;

      await ctx.db.$transaction(async (tx) => {
        await tx.recruiterInvoice.deleteMany({ where: { month: month } });
        await tx.recruiterCollection.deleteMany({ where: { month: month } });

        const emailToName = new Map<string, string>();
        input.deals.forEach((d) =>
          emailToName.set(d.recruiterEmail, d.recruiterName)
        );
        input.cashCollections.forEach((c) =>
          emailToName.set(c.recruiterEmail, c.recruiterName)
        );
        await Promise.all(
          Array.from(emailToName.entries()).map(([email, name]) =>
            tx.recruiter.upsert({
              where: { email },
              create: { email, name },
              update: { name },
            })
          )
        );

        if (positiveDeals.length > 0) {
          await tx.recruiterInvoice.createMany({
            data: positiveDeals.map((deal) => ({
              dealId: deal.dealId,
              dealLink: deal.dealLink,
              dealName: deal.dealName,
              amountInvoiced: deal.amountInvoiced,
              month: deal.month,
              recruiterEmail: deal.recruiterEmail,
            })),
          });
        }
        if (input.cashCollections.length > 0) {
          await tx.recruiterCollection.createMany({
            data: input.cashCollections.map((cashCollection) => ({
              amountPaid: cashCollection.amountPaid,
              month: cashCollection.month,
              dealId: cashCollection.dealId,
              recruiterEmail: cashCollection.recruiterEmail,
            })),
          });
        }

        for (const adjustment of negativeAdjustments) {
          try {
            await tx.recruiterInvoice.update({
              where: { dealId: adjustment.dealId },
              data: {
                amountInvoiced: {
                  decrement: Math.abs(adjustment.amountInvoiced),
                },
              },
            });
          } catch (error) {
            if (
              error instanceof Prisma.PrismaClientKnownRequestError &&
              error.code === "P2025"
            ) {
              throw new Error(
                `Adjustment failed: The original deal with ID "${adjustment.dealId}" was not found.`
              );
            }
            throw error;
          }
        }
      });

      // --- Determine the TRUE start month for recalculation ---
      if (negativeAdjustments.length > 0) {
        const adjustmentDealIds = negativeAdjustments.map((adj) => adj.dealId);
        const originalInvoices = await ctx.db.recruiterInvoice.findMany({
          where: { dealId: { in: adjustmentDealIds } },
          select: { month: true },
        });

        const allPossibleStartMonths = [
          month,
          ...originalInvoices.map((inv) => inv.month),
        ];
        allPossibleStartMonths.sort();

        const earliestMonth = allPossibleStartMonths[0];
        if (earliestMonth) {
          recalculationStartMonth = earliestMonth;
        }
      }

      // --- Massive Recalculation Logic (now starting from the correct month) ---
      const allRecruiters = await ctx.db.recruiter.findMany({
        select: { email: true },
      });
      const allSummariesAfterStart =
        await ctx.db.recruiterMonthlySummary.findMany({
          where: { month: { gte: recalculationStartMonth } },
          select: { month: true },
          distinct: ["month"],
          orderBy: { month: "asc" },
        });
      const monthsToProcess = [
        ...new Set([
          recalculationStartMonth,
          ...allSummariesAfterStart.map((s) => s.month),
        ]),
      ].sort();

      for (const rec of allRecruiters) {
        for (const m of monthsToProcess) {
          await updateRecruiterMonthlySummary(m, rec.email, ctx);
        }
      }
      for (const rec of allRecruiters) {
        await syncRecruiterThresholdStatus(rec.email, ctx);
      }
      for (const rec of allRecruiters) {
        for (const m of monthsToProcess) {
          await calculateRecruiterPayouts(m, rec.email, ctx);
        }
      }

      return { success: true, message: "Monthly data processed successfully" };
    }),
});

const updateRecruiterMonthlySummary = async (
  month: string,
  recruiterEmail: string,
  ctx: Awaited<ReturnType<typeof createTRPCContext>>
) => {
  const deals = await ctx.db.recruiterInvoice.findMany({
    where: { month, recruiterEmail },
  });
  const cashCollections = await ctx.db.recruiterCollection.findMany({
    where: { month, recruiterEmail },
  });

  const totalDealsCompleted = deals.reduce(
    (acc, deal) => acc + deal.amountInvoiced,
    0
  );
  const totalCashCollected = cashCollections.reduce(
    (acc, cc) => acc + cc.amountPaid,
    0
  );

  await ctx.db.recruiterMonthlySummary.upsert({
    where: { recruiterEmail_month: { recruiterEmail, month } },
    create: { month, totalDealsCompleted, totalCashCollected, recruiterEmail },
    update: { totalDealsCompleted, totalCashCollected },
  });
};

const calculateRecruiterPayouts = async (
  month: string,
  recruiterEmail: string,
  ctx: Awaited<ReturnType<typeof createTRPCContext>>
) => {
  const recruiter = await ctx.db.recruiter.findUnique({
    where: { email: recruiterEmail },
  });
  const summary = await ctx.db.recruiterMonthlySummary.findUnique({
    where: { recruiterEmail_month: { recruiterEmail, month } },
  });

  if (!recruiter || !summary) return;

  const totalCashCollected = summary.totalCashCollected;

  await ctx.db.recruiterPayout.deleteMany({
    where: { sourceSummaryMonth: month, sourceRecruiterEmail: recruiterEmail },
  });

  if (totalCashCollected > 0) {
    const baseRate = recruiter.has_reached_30k_deals_threshold ? 0.03 : 0.02;

    await ctx.db.recruiterPayout.create({
      data: {
        amount: totalCashCollected * baseRate,
        commissionRate: baseRate,
        payoutMonth: month,
        sourceSummaryMonth: month,
        sourceRecruiterEmail: recruiterEmail,
      },
    });

    if (
      totalCashCollected > 30000 &&
      recruiter.has_reached_30k_deals_threshold
    ) {
      const remainder = totalCashCollected - 30000;
      const bonusAmount = remainder * 0.02;
      const delayedPayoutMonthString = format(
        addMonths(parse(month, "yyyy-MM", new Date()), 1),
        "yyyy-MM"
      );

      await ctx.db.recruiterPayout.create({
        data: {
          amount: bonusAmount,
          commissionRate: 0.02,
          payoutMonth: delayedPayoutMonthString,
          sourceSummaryMonth: month,
          sourceRecruiterEmail: recruiterEmail,
        },
      });
    }
  }
};

const syncRecruiterThresholdStatus = async (
  recruiterEmail: string,
  ctx: Awaited<ReturnType<typeof createTRPCContext>>
): Promise<boolean> => {
  const recruiter = await ctx.db.recruiter.findUnique({
    where: { email: recruiterEmail },
  });
  if (!recruiter) return false;

  const summaryWithThreshold = await ctx.db.recruiterMonthlySummary.findFirst({
    where: { recruiterEmail, totalDealsCompleted: { gte: 30000 } },
  });

  const hasEverReachedThreshold = !!summaryWithThreshold;

  if (recruiter.has_reached_30k_deals_threshold !== hasEverReachedThreshold) {
    await ctx.db.recruiter.update({
      where: { email: recruiterEmail },
      data: { has_reached_30k_deals_threshold: hasEverReachedThreshold },
    });
    return true;
  }
  return false;
};
