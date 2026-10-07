import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Generous transaction limits: every query inside a transaction is a network round trip, and
// with the database far away (e.g. running locally against Supabase) the 5s default is too tight.
export const db =
  globalForPrisma.prisma ??
  new PrismaClient({ transactionOptions: { maxWait: 15_000, timeout: 30_000 } });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
