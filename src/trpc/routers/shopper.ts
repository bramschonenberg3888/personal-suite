import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../init';
import * as albertHeijn from '@/lib/api/albert-heijn';
import * as jumbo from '@/lib/api/jumbo';

export const shopperRouter = createTRPCRouter({
  // Supermarket management
  supermarket: createTRPCRouter({
    getAll: protectedProcedure.query(async ({ ctx }) => {
      return ctx.db.supermarket.findMany({
        orderBy: { name: 'asc' },
      });
    }),

    // Get user's enabled supermarkets (returns all supermarkets with enabled flag)
    getUserPreferences: protectedProcedure.query(async ({ ctx }) => {
      const supermarkets = await ctx.db.supermarket.findMany({
        orderBy: { name: 'asc' },
      });

      const userPrefs = await ctx.db.userSupermarket.findMany({
        where: { userId: ctx.userId },
        select: { supermarketId: true },
      });

      const enabledIds = new Set(userPrefs.map((p) => p.supermarketId));

      // If user has no preferences, all supermarkets are enabled by default
      const hasPreferences = enabledIds.size > 0;

      return supermarkets.map((s) => ({
        ...s,
        enabled: hasPreferences ? enabledIds.has(s.id) : true,
      }));
    }),

    // Toggle a supermarket preference
    togglePreference: protectedProcedure
      .input(z.object({ supermarketId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const existing = await ctx.db.userSupermarket.findUnique({
          where: {
            userId_supermarketId: {
              userId: ctx.userId,
              supermarketId: input.supermarketId,
            },
          },
        });

        if (existing) {
          // Remove preference (disable this supermarket)
          await ctx.db.userSupermarket.delete({
            where: { id: existing.id },
          });
          return { enabled: false };
        } else {
          // Check if user has any preferences set
          const userPrefs = await ctx.db.userSupermarket.findMany({
            where: { userId: ctx.userId },
          });

          if (userPrefs.length === 0) {
            // First time setting preferences - enable all OTHER supermarkets first
            const allSupermarkets = await ctx.db.supermarket.findMany();
            for (const s of allSupermarkets) {
              if (s.id !== input.supermarketId) {
                await ctx.db.userSupermarket.create({
                  data: {
                    userId: ctx.userId,
                    supermarketId: s.id,
                  },
                });
              }
            }
            // The clicked one is now disabled (not in the table)
            return { enabled: false };
          }

          // Add preference (enable this supermarket)
          await ctx.db.userSupermarket.create({
            data: {
              userId: ctx.userId,
              supermarketId: input.supermarketId,
            },
          });
          return { enabled: true };
        }
      }),

    // Seed supermarkets if they don't exist
    seed: protectedProcedure.mutation(async ({ ctx }) => {
      const supermarkets = [
        {
          name: 'Albert Heijn',
          url: 'https://www.ah.nl',
          logoUrl: 'https://www.ah.nl/favicon.ico',
        },
        {
          name: 'Jumbo',
          url: 'https://www.jumbo.com',
          logoUrl: 'https://www.jumbo.com/favicon.ico',
        },
      ];

      for (const market of supermarkets) {
        await ctx.db.supermarket.upsert({
          where: { name: market.name },
          update: {},
          create: market,
        });
      }

      return { success: true };
    }),
  }),

  // Product search
  search: createTRPCRouter({
    ah: protectedProcedure
      .input(
        z.object({
          query: z.string().min(2),
          page: z.number().min(0).default(0),
        })
      )
      .query(async ({ input }) => {
        const result = await albertHeijn.searchProducts(input.query, input.page);
        return {
          products: result.products.map((p) => ({
            externalId: p.id,
            name: p.title,
            category: p.category,
            imageUrl: p.images[0]?.url,
            currentPrice: p.currentPrice,
            originalPrice: p.priceBeforeBonus,
            unit: p.salesUnitSize,
            isOnSale: p.isBonus,
            salePrice: p.bonusPrice,
            supermarket: 'Albert Heijn' as const,
          })),
          totalCount: result.totalCount,
        };
      }),

    jumbo: protectedProcedure
      .input(
        z.object({
          query: z.string().min(2),
          offset: z.number().min(0).default(0),
        })
      )
      .query(async ({ input }) => {
        const result = await jumbo.searchProducts(input.query, input.offset);
        return {
          products: result.products.map((p) => ({
            externalId: p.id,
            name: p.title,
            category: p.category,
            imageUrl: p.imageUrl,
            currentPrice: p.prices.promotionalPrice?.amount ?? p.prices.price.amount,
            originalPrice: p.prices.promotionalPrice ? p.prices.price.amount : undefined,
            unit: p.quantityOptions[0]?.unit,
            isOnSale: p.isPromotion,
            salePrice: p.prices.promotionalPrice?.amount,
            supermarket: 'Jumbo' as const,
          })),
          totalCount: result.totalCount,
        };
      }),

    all: protectedProcedure
      .input(
        z.object({
          query: z.string().min(2),
          supermarkets: z.array(z.enum(['Albert Heijn', 'Jumbo'])).optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        // Get user preferences if no explicit filter provided
        let enabledSupermarkets = input.supermarkets;

        if (!enabledSupermarkets) {
          const supermarkets = await ctx.db.supermarket.findMany();
          const userPrefs = await ctx.db.userSupermarket.findMany({
            where: { userId: ctx.userId },
            select: { supermarketId: true },
          });

          if (userPrefs.length > 0) {
            const enabledIds = new Set(userPrefs.map((p) => p.supermarketId));
            enabledSupermarkets = supermarkets
              .filter((s) => enabledIds.has(s.id))
              .map((s) => s.name as 'Albert Heijn' | 'Jumbo');
          } else {
            // Default to all
            enabledSupermarkets = ['Albert Heijn', 'Jumbo'];
          }
        }

        const searchPromises: Promise<typeof ahResult | typeof jumboResult>[] = [];
        let ahResult = {
          products: [] as Awaited<ReturnType<typeof albertHeijn.searchProducts>>['products'],
        };
        let jumboResult = {
          products: [] as Awaited<ReturnType<typeof jumbo.searchProducts>>['products'],
        };

        if (enabledSupermarkets.includes('Albert Heijn')) {
          searchPromises.push(
            albertHeijn.searchProducts(input.query, 0, 10).then((r) => {
              ahResult = r;
              return r;
            })
          );
        }

        if (enabledSupermarkets.includes('Jumbo')) {
          searchPromises.push(
            jumbo.searchProducts(input.query, 0, 10).then((r) => {
              jumboResult = r;
              return r;
            })
          );
        }

        await Promise.all(searchPromises);

        const products = [
          ...ahResult.products.map((p) => ({
            externalId: p.id,
            name: p.title,
            category: p.category,
            imageUrl: p.images[0]?.url,
            currentPrice: p.currentPrice,
            originalPrice: p.priceBeforeBonus,
            unit: p.salesUnitSize,
            isOnSale: p.isBonus,
            salePrice: p.bonusPrice,
            supermarket: 'Albert Heijn' as const,
          })),
          ...jumboResult.products.map((p) => ({
            externalId: p.id,
            name: p.title,
            category: p.category,
            imageUrl: p.imageUrl,
            currentPrice: p.prices.promotionalPrice?.amount ?? p.prices.price.amount,
            originalPrice: p.prices.promotionalPrice ? p.prices.price.amount : undefined,
            unit: p.quantityOptions[0]?.unit,
            isOnSale: p.isPromotion,
            salePrice: p.prices.promotionalPrice?.amount,
            supermarket: 'Jumbo' as const,
          })),
        ];

        return { products };
      }),
  }),

  // Product tracking
  tracked: createTRPCRouter({
    getAll: protectedProcedure.query(async ({ ctx }) => {
      return ctx.db.trackedProduct.findMany({
        where: { userId: ctx.userId },
        include: {
          product: {
            include: {
              supermarket: true,
              priceHistory: {
                orderBy: { recordedAt: 'desc' },
                take: 30,
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }),

    track: protectedProcedure
      .input(
        z.object({
          externalId: z.string(),
          name: z.string(),
          supermarketName: z.string(),
          category: z.string().optional(),
          imageUrl: z.string().optional(),
          currentPrice: z.number(),
          unit: z.string().optional(),
          targetPrice: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Find or create supermarket
        let supermarket = await ctx.db.supermarket.findUnique({
          where: { name: input.supermarketName },
        });

        if (!supermarket) {
          supermarket = await ctx.db.supermarket.create({
            data: { name: input.supermarketName },
          });
        }

        // Find or create product
        let product = await ctx.db.product.findFirst({
          where: {
            externalId: input.externalId,
            supermarketId: supermarket.id,
          },
        });

        if (!product) {
          product = await ctx.db.product.create({
            data: {
              externalId: input.externalId,
              name: input.name,
              supermarketId: supermarket.id,
              category: input.category,
              imageUrl: input.imageUrl,
              currentPrice: input.currentPrice,
              unit: input.unit,
            },
          });

          // Record initial price history
          await ctx.db.priceHistory.create({
            data: {
              productId: product.id,
              price: input.currentPrice,
            },
          });
        }

        // Create tracked product
        return ctx.db.trackedProduct.create({
          data: {
            userId: ctx.userId,
            productId: product.id,
            targetPrice: input.targetPrice,
            alertOnSale: true,
          },
          include: {
            product: {
              include: {
                supermarket: true,
              },
            },
          },
        });
      }),

    untrack: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        return ctx.db.trackedProduct.delete({
          where: {
            id: input.id,
            userId: ctx.userId,
          },
        });
      }),

    setTargetPrice: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          targetPrice: z.number().nullable(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return ctx.db.trackedProduct.update({
          where: {
            id: input.id,
            userId: ctx.userId,
          },
          data: {
            targetPrice: input.targetPrice,
          },
        });
      }),
  }),

  // Price alerts
  alerts: createTRPCRouter({
    getActive: protectedProcedure.query(async ({ ctx }) => {
      const tracked = await ctx.db.trackedProduct.findMany({
        where: {
          userId: ctx.userId,
          OR: [{ alertOnSale: true }, { targetPrice: { not: null } }],
        },
        include: {
          product: {
            include: {
              supermarket: true,
            },
          },
        },
      });

      return tracked.filter((t) => {
        // Alert if product is below target price
        if (t.targetPrice && t.product.currentPrice <= t.targetPrice) {
          return true;
        }
        return false;
      });
    }),
  }),

  // Price refresh (would be called by a cron job in production)
  refreshPrices: protectedProcedure.mutation(async ({ ctx }) => {
    const trackedProducts = await ctx.db.trackedProduct.findMany({
      where: { userId: ctx.userId },
      include: {
        product: {
          include: {
            supermarket: true,
          },
        },
      },
    });

    for (const tracked of trackedProducts) {
      const { product } = tracked;
      let newPrice: number | null = null;

      try {
        if (product.supermarket.name === 'Albert Heijn') {
          const ahProduct = await albertHeijn.getProductById(product.externalId);
          if (ahProduct) {
            newPrice = ahProduct.currentPrice;
          }
        } else if (product.supermarket.name === 'Jumbo') {
          const jumboProduct = await jumbo.getProductById(product.externalId);
          if (jumboProduct) {
            newPrice =
              jumboProduct.prices.promotionalPrice?.amount ?? jumboProduct.prices.price.amount;
          }
        }

        if (newPrice !== null && newPrice !== product.currentPrice) {
          // Update product price
          await ctx.db.product.update({
            where: { id: product.id },
            data: { currentPrice: newPrice },
          });

          // Record price history
          await ctx.db.priceHistory.create({
            data: {
              productId: product.id,
              price: newPrice,
            },
          });
        }
      } catch (error) {
        console.error(`Failed to refresh price for ${product.name}:`, error);
      }
    }

    return { success: true };
  }),
});
