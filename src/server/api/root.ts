import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";
import { recruiterRouter } from "@/server/api/routers/recruiter";
import { recruitmentManagerRouter } from "@/server/api/routers/recruitment-manager";
import { accountExecutiveRouter } from "@/server/api/routers/account-executive";

export const appRouter = createTRPCRouter({
  recruiter: recruiterRouter,
  recruitmentManager: recruitmentManagerRouter,
  accountExecutive: accountExecutiveRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
