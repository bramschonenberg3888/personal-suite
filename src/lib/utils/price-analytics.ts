/**
 * Price analytics utilities for tracking price trends and statistics
 */

export interface PriceRecord {
  price: number;
  recordedAt: Date | string;
}

export interface PriceStats {
  min: number;
  max: number;
  avg: number;
  current: number;
  percentageChange: number;
  isAtHistoricalLow: boolean;
  lowestInDays: number | null;
  priceDropFromMax: number;
}

export type Period = '7d' | '30d' | '90d' | 'all';

const periodDays: Record<Period, number | null> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  all: null,
};

/**
 * Filter price history by time period
 */
export function filterByPeriod(history: PriceRecord[], period: Period): PriceRecord[] {
  const days = periodDays[period];
  if (!days) return history;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  return history.filter((record) => new Date(record.recordedAt) >= cutoff);
}

/**
 * Calculate comprehensive price statistics
 */
export function calculatePriceStats(priceHistory: PriceRecord[], currentPrice: number): PriceStats {
  if (priceHistory.length === 0) {
    return {
      min: currentPrice,
      max: currentPrice,
      avg: currentPrice,
      current: currentPrice,
      percentageChange: 0,
      isAtHistoricalLow: true,
      lowestInDays: null,
      priceDropFromMax: 0,
    };
  }

  const prices = priceHistory.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length;

  // Calculate percentage change from first recorded price
  const sortedHistory = [...priceHistory].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
  );
  const firstPrice = sortedHistory[0]?.price ?? currentPrice;
  const percentageChange = firstPrice !== 0 ? ((currentPrice - firstPrice) / firstPrice) * 100 : 0;

  // Check if current price is at historical low (with small tolerance for floating point)
  const tolerance = 0.01;
  const isAtHistoricalLow = currentPrice <= min + tolerance;

  // Calculate how many days since we've seen this low price
  let lowestInDays: number | null = null;
  if (isAtHistoricalLow) {
    // Find the last time the price was this low or lower
    const now = new Date();
    for (let i = sortedHistory.length - 1; i >= 0; i--) {
      if (sortedHistory[i].price <= currentPrice + tolerance) {
        const recordDate = new Date(sortedHistory[i].recordedAt);
        const daysDiff = Math.floor((now.getTime() - recordDate.getTime()) / (1000 * 60 * 60 * 24));
        lowestInDays = daysDiff;
        break;
      }
    }
  }

  // Calculate drop from maximum price
  const priceDropFromMax = max > 0 ? ((max - currentPrice) / max) * 100 : 0;

  return {
    min,
    max,
    avg,
    current: currentPrice,
    percentageChange,
    isAtHistoricalLow,
    lowestInDays,
    priceDropFromMax,
  };
}

/**
 * Calculate the week-over-week price drop
 */
export function calculateWeeklyPriceDrop(
  priceHistory: PriceRecord[],
  currentPrice: number
): number {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  // Find the price closest to a week ago
  const sortedHistory = [...priceHistory].sort(
    (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
  );

  let priceWeekAgo = currentPrice;
  for (const record of sortedHistory) {
    const recordDate = new Date(record.recordedAt);
    if (recordDate <= weekAgo) {
      priceWeekAgo = record.price;
      break;
    }
  }

  // Return positive number for price drops
  return priceWeekAgo - currentPrice;
}

/**
 * Calculate potential savings based on target price
 */
export function calculatePotentialSavings(
  currentPrice: number,
  targetPrice: number | null
): number {
  if (!targetPrice || currentPrice <= targetPrice) return 0;
  return currentPrice - targetPrice;
}

/**
 * Format percentage change for display
 */
export function formatPercentageChange(change: number): string {
  const formatted = Math.abs(change).toFixed(1);
  if (change > 0) return `+${formatted}%`;
  if (change < 0) return `-${formatted}%`;
  return '0%';
}
