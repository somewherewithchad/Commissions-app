import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "@/server/db";
import { env } from "@/env";
import { createAuthMiddleware, APIError } from "better-auth/api";

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: "mysql",
  }),
  trustedOrigins: [
    "http://localhost:3000",
    "https://commission-hub.somewhere.ac",
  ],
  socialProviders: {
    google: {
      prompt: "select_account",
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        input: true,
      },
    },
  },
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path.startsWith("/callback")) {
        const email = ctx.context.newSession?.user.email;
        if (!email) {
          throw new APIError("BAD_REQUEST", {
            message: "Email is required",
          });
        }
        const recruiter = await db.recruiter.findUnique({
          where: {
            email: email,
          },
        });

        if (recruiter) {
          await db.recruiter.update({
            where: { id: recruiter.id },
            data: {
              user: {
                connect: {
                  id: ctx.context.newSession?.user.id,
                },
              },
            },
          });
        } else {
          await db.recruiter.create({
            data: {
              name: ctx.context.newSession?.user.name ?? "",
              email: email,
              user: {
                connect: {
                  id: ctx.context.newSession?.user.id,
                },
              },
            },
          });
        }
      }
    }),
  },
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
