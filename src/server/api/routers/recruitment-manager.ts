import {
  createTRPCRouter,
  protectedProcedure,
  createTRPCContext,
} from "@/server/api/trpc";
import { addMonths, format, parse, subMonths } from "date-fns";
import { z } from "zod";

export const recruitmentManagerRouter = createTRPCRouter({
  // Queries
  getManagerData: protectedProcedure
    .input(z.object({ year: z.string().regex(/^\d{4}$/) }))
    .query(async ({ ctx, input }) => {
      const managerEmail = ctx.session.user.email;

      // 1. Fetch all summaries and payouts for the entire year for efficiency.
      const summaries = await ctx.db.recruitmentManagerMonthlySummary.findMany({
        where: { managerEmail, month: { startsWith: input.year } },
      });
      const payouts = await ctx.db.recruitmentManagerPayout.findMany({
        where: {
          sourceManagerEmail: managerEmail,
          payoutMonth: { startsWith: input.year },
        },
      });

      // 2. Group data by month for easy lookup.
      const summaryMap = new Map(summaries.map((s) => [s.month, s]));
      const payoutMap = new Map<string, number>();
      for (const p of payouts) {
        payoutMap.set(
          p.payoutMonth,
          (payoutMap.get(p.payoutMonth) ?? 0) + p.amount
        );
      }

      // 3. Build the data for all 12 months with the simplified structure.
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
  getManagerMonthDetails: protectedProcedure
    .input(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }))
    .query(async ({ ctx, input }) => {
      const managerEmail = ctx.session.user.email;

      const payouts = await ctx.db.recruitmentManagerPayout.findMany({
        where: { sourceManagerEmail: managerEmail, payoutMonth: input.month },
        orderBy: { amount: "desc" },
      });

      // Enrich payouts with their specific contributing collection and calculation basis
      // Ensure we don't reuse the same source collection for multiple payouts of identical amounts
      const usedCollectionIdsByMonth = new Map<string, Set<string>>();
      const enrichedPayouts: Array<any> = [];

      for (const payout of payouts) {
        const sourceCashCollections =
          await ctx.db.recruitmentManagerCollection.findMany({
            where: { managerEmail, month: payout.sourceSummaryMonth },
          });

        const usedSet =
          usedCollectionIdsByMonth.get(payout.sourceSummaryMonth) ??
          new Set<string>();
        const availableCollections = sourceCashCollections.filter(
          (c) => !usedSet.has(c.id)
        );

        // Prefetch invoice details for these deals (name, link, month)
        const dealIds = [...new Set(availableCollections.map((c) => c.dealId))];
        const deals = await ctx.db.recruitmentManagerInvoice.findMany({
          where: { dealId: { in: dealIds }, managerEmail },
        });
        const dealById = new Map(
          deals.map((d) => [
            d.dealId,
            { name: d.dealName, link: d.dealLink, month: d.month },
          ])
        );

        const isBonus = payout.payoutMonth !== payout.sourceSummaryMonth;

        // Helper for float comparison
        const approxEqual = (a: number, b: number, eps = 0.01) =>
          Math.abs(a - b) <= eps;

        let matchedCollection: (typeof availableCollections)[number] | null =
          null;
        let commissionRate = 0.01; // default base
        let sourceInvoiceTotal = 0;
        let sourceInvoiceMonth = payout.sourceSummaryMonth;

        if (!isBonus) {
          // Base payout: 1% of a single collection in the same month
          const targetAmountPaid = payout.amount / 0.01;
          const baseMatches = availableCollections.filter((c) =>
            approxEqual(c.amountPaid, targetAmountPaid)
          );
          if (baseMatches.length > 0) {
            // Prefer a match that has an associated invoice
            matchedCollection =
              baseMatches.find((c) => dealById.has(c.dealId)) ??
              baseMatches[0]!;
          } else {
            matchedCollection = null;
          }
          commissionRate = 0.01;
        } else {
          // Bonus payout: rate depends on the invoice month totals of each deal
          for (const c of availableCollections) {
            const dealInfo = dealById.get(c.dealId);
            if (!dealInfo) continue;
            const invMonth = dealInfo.month;
            const summary =
              await ctx.db.recruitmentManagerMonthlySummary.findUnique({
                where: {
                  managerEmail_month: { managerEmail, month: invMonth },
                },
              });
            const totalInv = summary?.totalInvoiced ?? 0;
            let rate = 0;
            if (totalInv >= 150000) rate = 0.005;
            else if (totalInv >= 100000) rate = 0.0025;
            else rate = 0; // no bonus for this deal

            if (rate > 0 && approxEqual(c.amountPaid * rate, payout.amount)) {
              matchedCollection = c;
              commissionRate = rate;
              sourceInvoiceTotal = totalInv;
              sourceInvoiceMonth = invMonth;
              break;
            }
          }
        }

        // Fallback: if we couldn't match precisely, pick the closest and infer the rate
        if (!matchedCollection && availableCollections.length > 0) {
          let best = availableCollections[0]!;
          let bestDelta = Math.abs(
            payout.amount - best.amountPaid * (isBonus ? 0.005 : 0.01)
          );
          for (const c of availableCollections) {
            const delta = Math.abs(
              payout.amount - c.amountPaid * (isBonus ? 0.005 : 0.01)
            );
            const cHasInvoice = dealById.has(c.dealId);
            const bestHasInvoice = dealById.has(best.dealId);
            if (
              delta < bestDelta ||
              (Math.abs(delta - bestDelta) <= 1e-6 &&
                cHasInvoice &&
                !bestHasInvoice)
            ) {
              best = c;
              bestDelta = delta;
            }
          }
          matchedCollection = best;
          // Infer the actual rate used from payout amount
          commissionRate =
            matchedCollection.amountPaid > 0
              ? payout.amount / matchedCollection.amountPaid
              : commissionRate;

          // Populate invoice-based context if available
          const dealInfo = dealById.get(matchedCollection.dealId);
          if (dealInfo) {
            sourceInvoiceMonth = dealInfo.month;
            const summary =
              await ctx.db.recruitmentManagerMonthlySummary.findUnique({
                where: {
                  managerEmail_month: { managerEmail, month: dealInfo.month },
                },
              });
            sourceInvoiceTotal = summary?.totalInvoiced ?? 0;
          }
        }

        const selectedDeal = matchedCollection
          ? dealById.get(matchedCollection.dealId)
          : undefined;

        if (matchedCollection) {
          usedSet.add(matchedCollection.id);
          if (!usedCollectionIdsByMonth.has(payout.sourceSummaryMonth)) {
            usedCollectionIdsByMonth.set(payout.sourceSummaryMonth, usedSet);
          }
        }

        enrichedPayouts.push({
          ...payout,
          type: isBonus ? "bonus" : "base",
          commissionRate,
          sourceInvoiceTotal,
          sourceInvoiceMonth,
          sourceCollection: matchedCollection
            ? {
                id: matchedCollection.id,
                dealId: matchedCollection.dealId,
                dealName: selectedDeal?.name ?? "Unknown Deal",
                dealLink: selectedDeal?.link ?? null,
                amountPaid: matchedCollection.amountPaid,
              }
            : null,
        });
      }

      return { payouts: enrichedPayouts };
    }),
  getPayoutsByMonth: protectedProcedure
    .input(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }))
    .query(async ({ ctx, input }) => {
      if (ctx.session?.user?.role !== "admin") {
        throw new Error("Not authorized");
      }

      const payoutsRaw = await ctx.db.recruitmentManagerPayout.findMany({
        where: { payoutMonth: input.month },
        orderBy: { amount: "desc" },
      });

      if (payoutsRaw.length === 0) return [] as const;

      // Collect keys for bulk fetches
      const uniqueEmails = Array.from(
        new Set(payoutsRaw.map((p) => p.sourceManagerEmail))
      );
      const uniqueSourceMonths = Array.from(
        new Set(payoutsRaw.map((p) => p.sourceSummaryMonth))
      );

      // Managers
      const managers = await ctx.db.recruitmentManager.findMany({
        where: { email: { in: uniqueEmails } },
      });
      const emailToManager = new Map(managers.map((m) => [m.email, m]));

      // Collections for those emails and months
      const allCollections = await ctx.db.recruitmentManagerCollection.findMany(
        {
          where: {
            managerEmail: { in: uniqueEmails },
            month: { in: uniqueSourceMonths },
          },
        }
      );

      // Invoices for deals referenced by those collections (to get name/link and invoice months)
      const allDealIds = Array.from(
        new Set(allCollections.map((c) => c.dealId))
      );
      const relatedInvoices = await ctx.db.recruitmentManagerInvoice.findMany({
        where: {
          dealId: { in: allDealIds },
          managerEmail: { in: uniqueEmails },
        },
      });
      const dealIdToInvoice = new Map(
        relatedInvoices.map((inv) => [inv.dealId, inv])
      );

      // Monthly summaries for invoice months (to determine bonus thresholds)
      const uniqueInvoiceMonths = Array.from(
        new Set(relatedInvoices.map((inv) => inv.month))
      );
      const monthlySummaries =
        await ctx.db.recruitmentManagerMonthlySummary.findMany({
          where: {
            managerEmail: { in: uniqueEmails },
            month: { in: uniqueInvoiceMonths },
          },
        });
      const managerMonthToInvoiceTotal = new Map(
        monthlySummaries.map((s) => [
          `${s.managerEmail}__${s.month}`,
          s.totalInvoiced,
        ])
      );

      const keyFor = (email: string, month: string) => `${email}__${month}`;
      const collectionsByEmailMonth = new Map<string, typeof allCollections>();
      for (const c of allCollections) {
        const k = keyFor(c.managerEmail, c.month);
        const list = collectionsByEmailMonth.get(k);
        if (list) list.push(c);
        else collectionsByEmailMonth.set(k, [c]);
      }

      const approxEqual = (a: number, b: number, eps = 0.01) =>
        Math.abs(a - b) <= eps;

      const usedCollectionIdsByEmailMonth = new Map<string, Set<string>>();

      const results = await Promise.all(
        payoutsRaw.map(async (p) => {
          const manager = emailToManager.get(p.sourceManagerEmail);
          const isBonus = p.payoutMonth !== p.sourceSummaryMonth;
          const candidateCollections =
            collectionsByEmailMonth.get(
              keyFor(p.sourceManagerEmail, p.sourceSummaryMonth)
            ) ?? [];

          const usedSet =
            usedCollectionIdsByEmailMonth.get(
              keyFor(p.sourceManagerEmail, p.sourceSummaryMonth)
            ) ?? new Set<string>();
          const availableCollections = candidateCollections.filter(
            (c) => !usedSet.has(c.id)
          );

          let matchedCollection: (typeof availableCollections)[number] | null =
            null;
          let commissionRate = 0.01; // default base
          let sourceInvoiceMonth = p.sourceSummaryMonth;
          let sourceInvoiceTotal = 0;

          if (!isBonus) {
            const targetAmountPaid = p.amount / 0.01;
            const baseMatches = availableCollections.filter((c) =>
              approxEqual(c.amountPaid, targetAmountPaid)
            );
            if (baseMatches.length > 0) {
              matchedCollection =
                baseMatches.find((c) => dealIdToInvoice.has(c.dealId)) ??
                baseMatches[0]!;
            } else {
              matchedCollection = null;
            }
            commissionRate = 0.01;
          } else {
            for (const c of availableCollections) {
              const inv = dealIdToInvoice.get(c.dealId);
              if (!inv) continue;
              const totalInv =
                managerMonthToInvoiceTotal.get(
                  keyFor(p.sourceManagerEmail, inv.month)
                ) ?? 0;
              let rate = 0;
              if (totalInv >= 150000) rate = 0.005;
              else if (totalInv >= 100000) rate = 0.0025;
              else rate = 0;
              if (rate > 0 && approxEqual(c.amountPaid * rate, p.amount)) {
                matchedCollection = c;
                commissionRate = rate;
                sourceInvoiceMonth = inv.month;
                sourceInvoiceTotal = totalInv;
                break;
              }
            }
          }

          if (!matchedCollection && availableCollections.length > 0) {
            let best = availableCollections[0]!;
            let assumedRate = isBonus ? 0.005 : 0.01;
            let bestDelta = Math.abs(p.amount - best.amountPaid * assumedRate);
            for (const c of availableCollections) {
              const delta = Math.abs(p.amount - c.amountPaid * assumedRate);
              const cHasInvoice = dealIdToInvoice.has(c.dealId);
              const bestHasInvoice = dealIdToInvoice.has(best.dealId);
              if (
                delta < bestDelta ||
                (Math.abs(delta - bestDelta) <= 1e-6 &&
                  cHasInvoice &&
                  !bestHasInvoice)
              ) {
                best = c;
                bestDelta = delta;
              }
            }
            matchedCollection = best;
            commissionRate =
              matchedCollection.amountPaid > 0
                ? p.amount / matchedCollection.amountPaid
                : commissionRate;
            const inv = dealIdToInvoice.get(matchedCollection.dealId);
            if (inv) {
              sourceInvoiceMonth = inv.month;
              sourceInvoiceTotal =
                managerMonthToInvoiceTotal.get(
                  keyFor(p.sourceManagerEmail, inv.month)
                ) ?? 0;
            }
          }

          if (matchedCollection) {
            usedSet.add(matchedCollection.id);
            if (
              !usedCollectionIdsByEmailMonth.has(
                keyFor(p.sourceManagerEmail, p.sourceSummaryMonth)
              )
            ) {
              usedCollectionIdsByEmailMonth.set(
                keyFor(p.sourceManagerEmail, p.sourceSummaryMonth),
                usedSet
              );
            }
          }

          return {
            ...p,
            managerName: manager?.name ?? null,
            type: isBonus ? "bonus" : "base",
            commissionRate,
            sourceInvoiceMonth,
            sourceInvoiceTotal,
            sourceCollection: matchedCollection
              ? {
                  id: matchedCollection.id,
                  dealId: matchedCollection.dealId,
                  dealName:
                    dealIdToInvoice.get(matchedCollection.dealId)?.dealName ??
                    null,
                  dealLink:
                    dealIdToInvoice.get(matchedCollection.dealId)?.dealLink ??
                    null,
                  amountPaid: matchedCollection.amountPaid,
                }
              : null,
          } as const;
        })
      );

      return results;
    }),
  // Mutations
  addMonthlyData: protectedProcedure
    .input(
      z.object({
        invoices: z.array(
          z.object({
            dealId: z.string(),
            dealLink: z.string().optional(),
            dealName: z.string(),
            managerName: z.string(),
            managerEmail: z.string().email(),
            amountInvoiced: z.number(),
            month: z.string().regex(/^\d{4}-\d{2}$/),
          })
        ),
        collections: z.array(
          z.object({
            dealId: z.string(),
            managerName: z.string(),
            managerEmail: z.string().email(),
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

      await ctx.db.$transaction(async (tx) => {
        // Step 1: Wipe all data for this month.
        await tx.recruitmentManagerInvoice.deleteMany({
          where: { month: month },
        });
        await tx.recruitmentManagerCollection.deleteMany({
          where: { month: month },
        });

        // Step 2: Upsert manager profiles from the new file.
        const emailToNameMap = new Map<string, string>();
        input.invoices.forEach((i) =>
          emailToNameMap.set(i.managerEmail, i.managerName)
        );
        input.collections.forEach((c) =>
          emailToNameMap.set(c.managerEmail, c.managerName)
        );
        await Promise.all(
          Array.from(emailToNameMap.entries()).map(([email, name]) =>
            tx.recruitmentManager.upsert({
              where: { email },
              create: { email, name },
              update: { name },
            })
          )
        );

        // Step 3: Insert the new data.
        if (input.invoices.length > 0) {
          await tx.recruitmentManagerInvoice.createMany({
            data: input.invoices.map((invoice) => ({
              dealId: invoice.dealId,
              dealLink: invoice.dealLink,
              dealName: invoice.dealName,
              amountInvoiced: invoice.amountInvoiced,
              month: invoice.month,
              managerEmail: invoice.managerEmail,
            })),
          });
        }
        if (input.collections.length > 0) {
          await tx.recruitmentManagerCollection.createMany({
            data: input.collections.map((collection) => ({
              dealId: collection.dealId,
              amountPaid: collection.amountPaid,
              month: collection.month,
              managerEmail: collection.managerEmail,
            })),
          });
        }
      });

      // --- "MASSIVE RECALCULATION" LOGIC ---
      const allManagers = await ctx.db.recruitmentManager.findMany({
        select: { email: true },
      });
      const allFutureSummaries =
        await ctx.db.recruitmentManagerMonthlySummary.findMany({
          where: { month: { gte: month } },
          select: { month: true },
          distinct: ["month"],
          orderBy: { month: "asc" },
        });
      const monthsToRecalculate = [
        ...new Set([month, ...allFutureSummaries.map((s) => s.month)]),
      ].sort();

      // Step 4: First, update all summaries for all affected months. This ensures the data is correct before calculating payouts.
      for (const manager of allManagers) {
        for (const m of monthsToRecalculate) {
          await updateManagerMonthlySummary(m, manager.email, ctx);
        }
      }

      // Step 5: Then, calculate all payouts. This loop reads the now-correct summary data.
      for (const manager of allManagers) {
        for (const m of monthsToRecalculate) {
          await calculateManagerPayouts(m, manager.email, ctx);
        }
      }

      return {
        success: true,
        message: "Monthly data processed successfully",
      };
    }),
});

const updateManagerMonthlySummary = async (
  month: string,
  managerEmail: string,
  ctx: Awaited<ReturnType<typeof createTRPCContext>>
) => {
  const invoiceAggregation = await ctx.db.recruitmentManagerInvoice.aggregate({
    _sum: { amountInvoiced: true },
    where: { managerEmail, month },
  });
  const collectionAggregation =
    await ctx.db.recruitmentManagerCollection.aggregate({
      _sum: { amountPaid: true },
      where: { managerEmail, month },
    });

  const totalInvoiced = invoiceAggregation._sum.amountInvoiced ?? 0;
  const totalCollections = collectionAggregation._sum.amountPaid ?? 0;

  await ctx.db.recruitmentManagerMonthlySummary.upsert({
    where: { managerEmail_month: { managerEmail, month } },
    create: { month, managerEmail, totalInvoiced, totalCollections },
    update: { totalInvoiced, totalCollections },
  });
};

const calculateManagerPayouts = async (
  month: string, // The month of the collections being processed
  managerEmail: string,
  ctx: Awaited<ReturnType<typeof createTRPCContext>>
) => {
  await ctx.db.recruitmentManagerPayout.deleteMany({
    where: { sourceManagerEmail: managerEmail, sourceSummaryMonth: month },
  });

  const collections = await ctx.db.recruitmentManagerCollection.findMany({
    where: { managerEmail, month },
  });
  if (collections.length === 0) return;

  const uniqueDealIds = [...new Set(collections.map((c) => c.dealId))];
  const sourceInvoices = await ctx.db.recruitmentManagerInvoice.findMany({
    where: { dealId: { in: uniqueDealIds }, managerEmail },
  });
  const dealIdToInvoiceMonthMap = new Map(
    sourceInvoices.map((inv) => [inv.dealId, inv.month])
  );

  const uniqueInvoiceMonths = [
    ...new Set(sourceInvoices.map((inv) => inv.month)),
  ];

  const monthlySummaries =
    await ctx.db.recruitmentManagerMonthlySummary.findMany({
      where: { managerEmail, month: { in: uniqueInvoiceMonths } },
    });
  const monthlyInvoiceTotals = new Map<string, number>(
    monthlySummaries.map((s) => [s.month, s.totalInvoiced])
  );

  for (const collection of collections) {
    const invoiceMonth = dealIdToInvoiceMonthMap.get(collection.dealId);
    if (!invoiceMonth) continue;

    const totalInvoicedForMonth = monthlyInvoiceTotals.get(invoiceMonth) ?? 0;

    // Base 1% payout, paid in the collection month
    await ctx.db.recruitmentManagerPayout.create({
      data: {
        amount: collection.amountPaid * 0.01,
        payoutMonth: month,
        sourceSummaryMonth: month,
        sourceManagerEmail: managerEmail,
      },
    });

    // Bonus payout logic
    let bonusRate = 0;
    if (totalInvoicedForMonth >= 150000) {
      bonusRate = 0.005;
    } else if (totalInvoicedForMonth >= 100000) {
      bonusRate = 0.0025;
    }

    if (bonusRate > 0) {
      const delayedPayoutMonth = format(
        addMonths(parse(month, "yyyy-MM", new Date()), 1),
        "yyyy-MM"
      );
      await ctx.db.recruitmentManagerPayout.create({
        data: {
          amount: collection.amountPaid * bonusRate,
          payoutMonth: delayedPayoutMonth,
          sourceSummaryMonth: month,
          sourceManagerEmail: managerEmail,
        },
      });
    }
  }
};
