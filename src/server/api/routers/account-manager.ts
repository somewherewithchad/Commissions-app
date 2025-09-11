import {
  createTRPCRouter,
  protectedProcedure,
  createTRPCContext,
  adminProcedure,
} from "@/server/api/trpc";
import { z } from "zod";
import { lastLockedMonth } from "@/lib/utils";
import { addMonths, format, parse } from "date-fns";
import { customAlphabet } from "nanoid";
const nanoid = customAlphabet("1234567890abcdefghijklmnopqrstuvwxyz", 6);

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
  getPayoutsByMonth: protectedProcedure
    .input(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }))
    .query(async ({ ctx, input }) => {
      if (ctx.session?.user?.role !== "admin") {
        throw new Error("Not authorized");
      }

      const payoutsRaw = await ctx.db.accountManagerPayout.findMany({
        where: { payoutMonth: input.month },
        orderBy: { amount: "desc" },
      });
      if (payoutsRaw.length === 0) return [] as const;

      const uniqueEmails = Array.from(
        new Set(payoutsRaw.map((p) => p.sourceAccountManagerEmail))
      );
      const uniqueSourceMonths = Array.from(
        new Set(payoutsRaw.map((p) => p.sourceSummaryMonth))
      );

      const managers = await ctx.db.accountManager.findMany({
        where: { email: { in: uniqueEmails } },
      });
      const emailToManager = new Map(managers.map((m) => [m.email, m]));

      const allCollections = await ctx.db.accountManagerCollection.findMany({
        where: {
          accountManagerEmail: { in: uniqueEmails },
          month: { in: uniqueSourceMonths },
        },
      });
      const keyFor = (email: string, month: string) => `${email}__${month}`;
      const collectionsByEmailMonth = new Map<string, typeof allCollections>();
      for (const c of allCollections) {
        const k = keyFor(c.accountManagerEmail, c.month);
        const list = collectionsByEmailMonth.get(k);
        if (list) list.push(c);
        else collectionsByEmailMonth.set(k, [c]);
      }

      const allDealIds = Array.from(
        new Set(allCollections.map((c) => c.dealId))
      );
      const relatedInvoices = await ctx.db.accountManagerInvoice.findMany({
        where: {
          dealId: { in: allDealIds },
          accountManagerEmail: { in: uniqueEmails },
        },
      });
      const dealIdToInvoice = new Map(
        relatedInvoices.map((inv) => [inv.dealId, inv])
      );

      const uniqueInvoiceMonths = Array.from(
        new Set(relatedInvoices.map((inv) => inv.month))
      );
      const monthlySummaries =
        await ctx.db.accountManagerMonthlySummary.findMany({
          where: {
            accountManagerEmail: { in: uniqueEmails },
            month: { in: uniqueInvoiceMonths },
          },
        });
      const managerMonthToInvoiceTotal = new Map(
        monthlySummaries.map((s) => [
          keyFor(s.accountManagerEmail, s.month),
          s.totalInvoiced,
        ])
      );

      const approxEqual = (a: number, b: number, eps = 0.01) =>
        Math.abs(a - b) <= eps;
      const usedCollectionIdsByKey = new Map<string, Set<string>>();
      // Track owner-bonus matches separately so multiple owner-bonus payouts
      // in the same month do not all attach to the same collection row.
      const usedOwnerCollectionIdsByKey = new Map<string, Set<string>>();

      const results = await Promise.all(
        payoutsRaw.map(async (p) => {
          const isBonus = p.payoutMonth !== p.sourceSummaryMonth;
          const isOwnerBonus = !!p.isDealOwnerBonus;
          const k = keyFor(p.sourceAccountManagerEmail, p.sourceSummaryMonth);
          const ownerUsedSet =
            usedOwnerCollectionIdsByKey.get(k) ?? new Set<string>();
          const nonOwnerUsedSet =
            usedCollectionIdsByKey.get(k) ?? new Set<string>();
          const allCandidates = collectionsByEmailMonth.get(k) ?? [];
          const candidates = isOwnerBonus
            ? allCandidates.filter((c) => !ownerUsedSet.has(c.id))
            : allCandidates.filter((c) => !nonOwnerUsedSet.has(c.id));

          let matched: (typeof candidates)[number] | null = null;
          let sourceInvoiceMonth = p.sourceSummaryMonth;
          let sourceInvoiceTotal = 0;
          const rate = p.commissionRate;

          // Try to match based on rate
          if (rate > 0) {
            const target = p.amount / rate;
            const matches = candidates.filter((c) =>
              approxEqual(c.amountPaid, target)
            );
            if (matches.length > 0) {
              if (isOwnerBonus) {
                matched =
                  matches.find(
                    (c) => dealIdToInvoice.get(c.dealId)?.isDealOwner === true
                  ) ??
                  matches.find((c) => dealIdToInvoice.has(c.dealId)) ??
                  matches[0]!;
              } else {
                matched =
                  matches.find((c) => dealIdToInvoice.has(c.dealId)) ??
                  matches[0]!;
              }
            }
          }

          // Fallback to closest
          if (!matched && candidates.length > 0 && rate > 0) {
            let best = candidates[0]!;
            let bestDelta = Math.abs(p.amount - best.amountPaid * rate);
            for (const c of candidates) {
              const delta = Math.abs(p.amount - c.amountPaid * rate);
              const cHasInvoice = dealIdToInvoice.has(c.dealId);
              const bestHasInvoice = dealIdToInvoice.has(best.dealId);
              if (
                delta < bestDelta ||
                (Math.abs(delta - bestDelta) <= 1e-6 &&
                  // Prefer a candidate with invoice, and if owner bonus, prefer deal-owner invoice
                  (isOwnerBonus
                    ? dealIdToInvoice.get(c.dealId)?.isDealOwner === true
                    : cHasInvoice) &&
                  !bestHasInvoice)
              ) {
                best = c;
                bestDelta = delta;
              }
            }
            matched = best;
          }

          if (matched) {
            if (isOwnerBonus) {
              ownerUsedSet.add(matched.id);
              if (!usedOwnerCollectionIdsByKey.has(k))
                usedOwnerCollectionIdsByKey.set(k, ownerUsedSet);
            } else {
              nonOwnerUsedSet.add(matched.id);
              if (!usedCollectionIdsByKey.has(k))
                usedCollectionIdsByKey.set(k, nonOwnerUsedSet);
            }
            const inv = dealIdToInvoice.get(matched.dealId);
            if (inv) {
              sourceInvoiceMonth = inv.month;
              sourceInvoiceTotal =
                managerMonthToInvoiceTotal.get(
                  keyFor(p.sourceAccountManagerEmail, inv.month)
                ) ?? 0;
            }
          }

          const type = p.isDealOwnerBonus
            ? ("owner-bonus" as const)
            : isBonus
            ? ("bonus" as const)
            : ("base" as const);

          return {
            ...p,
            managerName:
              emailToManager.get(p.sourceAccountManagerEmail)?.name ?? null,
            type,
            sourceInvoiceMonth,
            sourceInvoiceTotal,
            sourceCollection: matched
              ? {
                  id: matched.id,
                  dealId: matched.dealId,
                  dealName:
                    dealIdToInvoice.get(matched.dealId)?.dealName ?? null,
                  dealLink:
                    dealIdToInvoice.get(matched.dealId)?.dealLink ?? null,
                  amountPaid: matched.amountPaid,
                }
              : null,
          } as const;
        })
      );

      return results;
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

      await ctx.db.accountManagerInvoice.deleteMany({
        where: { month: month },
      });
      await ctx.db.accountManagerCollection.deleteMany({
        where: { month: month },
      });

      const referencedEmails = Array.from(
        new Set([
          ...input.invoices.map((i) => i.accountManagerEmail),
          ...input.collections.map((c) => c.accountManagerEmail),
        ])
      );

      if (referencedEmails.length > 0) {
        const existing = await ctx.db.accountManager.findMany({
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
        await ctx.db.accountManagerInvoice.createMany({
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

      if (negativeAdjustments.length > 0) {
        await ctx.db.accountManagerInvoice.createMany({
          data: negativeAdjustments.map((adjustment) => ({
            dealId: `${adjustment.dealId}-${nanoid()}`,
            dealLink: adjustment.dealLink,
            dealName: adjustment.dealName,
            amountInvoiced: adjustment.amountInvoiced,
            month: adjustment.month,
            isDealOwner: adjustment.isDealOwner,
            accountManagerEmail: adjustment.accountManagerEmail,
          })),
        });
      }

      if (input.collections.length > 0) {
        await ctx.db.accountManagerCollection.createMany({
          data: input.collections.map((collection) => ({
            dealId: collection.dealId,
            amountPaid: collection.amountPaid,
            month: collection.month,
            accountManagerEmail: collection.accountManagerEmail,
          })),
        });
      }

      const uniqueAccountManagers = Array.from(
        new Set(input.collections.map((c) => c.accountManagerEmail))
      );

      for (const accountManager of uniqueAccountManagers) {
        const totalInvoiced = input.invoices
          .filter(
            (i) => i.month === month && i.accountManagerEmail === accountManager
          )
          .reduce((acc, i) => acc + i.amountInvoiced, 0);
        const totalCollections = input.collections
          .filter(
            (c) => c.month === month && c.accountManagerEmail === accountManager
          )
          .reduce((acc, c) => acc + c.amountPaid, 0);

        await ctx.db.accountManagerMonthlySummary.create({
          data: {
            month: month,
            accountManagerEmail: accountManager,
            totalInvoiced: totalInvoiced,
            totalCollections: totalCollections,
          },
        });

        // Calculate payouts (procedural, no Sets; allow negative payouts)
        const managerConfig = await ctx.db.accountManager.findUnique({
          where: { email: accountManager },
        });
        if (!managerConfig) {
          continue;
        }

        const collections = await ctx.db.accountManagerCollection.findMany({
          where: { accountManagerEmail: accountManager, month },
        });

        if (managerConfig.isAmerican) {
          // Base monthly payout at americanCommissionRate applied to totalCollections (can be negative)
          const baseRate = managerConfig.americanCommissionRate ?? 0;
          if (baseRate !== 0 && totalCollections !== 0) {
            await ctx.db.accountManagerPayout.create({
              data: {
                amount: totalCollections * baseRate,
                commissionRate: baseRate,
                payoutMonth: month,
                sourceSummaryMonth: month,
                sourceAccountManagerEmail: accountManager,
              },
            });
          }

          // Deal owner bonus: 2% of each collection row in current month
          for (let i = 0; i < collections.length; i++) {
            const col = collections[i]!;

            const inv = await ctx.db.accountManagerInvoice.findFirst({
              where: {
                accountManagerEmail: accountManager,
                dealId: {
                  startsWith: col.dealId.split("-")[0],
                },
              },
              select: { isDealOwner: true },
            });
            if (inv && inv.isDealOwner) {
              await ctx.db.accountManagerPayout.create({
                data: {
                  amount: col.amountPaid * 0.02,
                  commissionRate: 0.02,
                  payoutMonth: month,
                  sourceSummaryMonth: month,
                  sourceAccountManagerEmail: accountManager,
                  isDealOwnerBonus: true,
                },
              });
            }
          }
        } else {
          // Non-American: row-by-row using invoice-month totals to determine tiers
          const nextMonth = format(
            addMonths(parse(month, "yyyy-MM", new Date()), 1),
            "yyyy-MM"
          );
          const tier1Rate = managerConfig.tier1CommissionRate ?? 0;
          const tier2Rate = managerConfig.tier2CommissionRate ?? 0;
          const tier3Rate = managerConfig.tier3CommissionRate ?? 0;
          const tier1Threshold =
            managerConfig.tier1Threshold ?? Number.POSITIVE_INFINITY;
          const tier2Threshold =
            managerConfig.tier2Threshold ?? Number.POSITIVE_INFINITY;

          for (let i = 0; i < collections.length; i++) {
            const col = collections[i]!;

            // Find invoice month for this deal
            const invoice = await ctx.db.accountManagerInvoice.findFirst({
              where: {
                accountManagerEmail: accountManager,
                dealId: col.dealId,
              },
              select: { month: true },
            });

            // Determine total invoiced for that invoice month (0 if not found)
            let totalInvoicedForInvoiceMonth = 0;
            if (invoice && invoice.month) {
              const agg = await ctx.db.accountManagerInvoice.aggregate({
                _sum: { amountInvoiced: true },
                where: {
                  accountManagerEmail: accountManager,
                  month: invoice.month,
                },
              });
              totalInvoicedForInvoiceMonth = agg._sum.amountInvoiced ?? 0;
            }

            // Point (a): always pay tier1 in current month
            if (tier1Rate !== 0) {
              await ctx.db.accountManagerPayout.create({
                data: {
                  amount: col.amountPaid * tier1Rate,
                  commissionRate: tier1Rate,
                  payoutMonth: month,
                  sourceSummaryMonth: month,
                  sourceAccountManagerEmail: accountManager,
                },
              });
            }

            // Point (b): if > tier1Threshold and <= tier2Threshold, add tier2 next month
            if (
              totalInvoicedForInvoiceMonth > tier1Threshold &&
              tier2Rate !== 0
            ) {
              await ctx.db.accountManagerPayout.create({
                data: {
                  amount: col.amountPaid * tier2Rate,
                  commissionRate: tier2Rate,
                  payoutMonth: nextMonth,
                  sourceSummaryMonth: month,
                  sourceAccountManagerEmail: accountManager,
                },
              });
            }

            // Point (c): if > tier2Threshold, also add tier3 next month
            if (
              totalInvoicedForInvoiceMonth > tier2Threshold &&
              tier3Rate !== 0
            ) {
              await ctx.db.accountManagerPayout.create({
                data: {
                  amount: col.amountPaid * tier3Rate,
                  commissionRate: tier3Rate,
                  payoutMonth: nextMonth,
                  sourceSummaryMonth: month,
                  sourceAccountManagerEmail: accountManager,
                },
              });
            }
          }
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
