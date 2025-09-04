import {
  createTRPCRouter,
  protectedProcedure,
  createTRPCContext,
} from "@/server/api/trpc";
import { Prisma } from "@prisma/client";
import { addMonths, format, parse } from "date-fns";
import { z } from "zod";

export const accountExecutiveRouter = createTRPCRouter({
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
      return {
        success: true,
        message: "Monthly data added successfully",
      };
    }),
});
