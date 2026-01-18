import { initTRPC } from '@trpc/server';
import { cache } from 'react';
import { db } from '@/lib/db';

// Default user ID for single-user mode (no authentication required)
export const DEFAULT_USER_ID = 'default-user';

/**
 * Ensures the default user exists in the database
 */
async function ensureDefaultUser() {
  const user = await db.user.findUnique({
    where: { id: DEFAULT_USER_ID },
  });

  if (!user) {
    await db.user.create({
      data: {
        id: DEFAULT_USER_ID,
        name: 'User',
        email: 'user@personal-suite.local',
      },
    });
  }

  return DEFAULT_USER_ID;
}

/**
 * Create tRPC context
 */
export const createTRPCContext = cache(async () => {
  const userId = await ensureDefaultUser();
  return {
    userId,
    db,
  };
});

const t = initTRPC.context<typeof createTRPCContext>().create();

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const baseProcedure = t.procedure;

/**
 * Protected procedure - now just passes through (single-user mode)
 */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
    },
  });
});
