/**
 * Unit price calculation utilities for product comparison
 */

export type UnitType = 'kg' | 'liter' | 'stuk' | 'unknown';

export interface ParsedUnit {
  quantity: number;
  type: UnitType;
  originalUnit: string;
}

/**
 * Parse a unit string like "500g", "1.5L", "per stuk", "2 stuks" into normalized format
 */
export function parseUnitString(unit: string | null | undefined): ParsedUnit | null {
  if (!unit) return null;

  const normalized = unit.toLowerCase().trim();

  // Handle "per stuk" or "stuk" variations
  if (normalized.includes('stuk') || normalized.includes('per stuk')) {
    const match = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:x\s*)?stuk/i);
    const quantity = match ? parseFloat(match[1].replace(',', '.')) : 1;
    return { quantity, type: 'stuk', originalUnit: unit };
  }

  // Handle weight (g, kg)
  const weightMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|gram)/i);
  if (weightMatch) {
    let quantity = parseFloat(weightMatch[1].replace(',', '.'));
    const unitType = weightMatch[2].toLowerCase();

    // Convert grams to kilograms
    if (unitType === 'g' || unitType === 'gram') {
      quantity = quantity / 1000;
    }

    return { quantity, type: 'kg', originalUnit: unit };
  }

  // Handle volume (L, ml, cl)
  const volumeMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(l|liter|litre|ml|cl)/i);
  if (volumeMatch) {
    let quantity = parseFloat(volumeMatch[1].replace(',', '.'));
    const unitType = volumeMatch[2].toLowerCase();

    // Convert ml/cl to liters
    if (unitType === 'ml') {
      quantity = quantity / 1000;
    } else if (unitType === 'cl') {
      quantity = quantity / 100;
    }

    return { quantity, type: 'liter', originalUnit: unit };
  }

  // Handle combined formats like "6 x 330 ml"
  const combinedMatch = normalized.match(/(\d+)\s*x\s*(\d+(?:[.,]\d+)?)\s*(ml|cl|l|g|kg)/i);
  if (combinedMatch) {
    const count = parseInt(combinedMatch[1], 10);
    let unitQuantity = parseFloat(combinedMatch[2].replace(',', '.'));
    const unitType = combinedMatch[3].toLowerCase();

    // Determine if weight or volume
    if (unitType === 'ml') {
      return { quantity: (count * unitQuantity) / 1000, type: 'liter', originalUnit: unit };
    } else if (unitType === 'cl') {
      return { quantity: (count * unitQuantity) / 100, type: 'liter', originalUnit: unit };
    } else if (unitType === 'l') {
      return { quantity: count * unitQuantity, type: 'liter', originalUnit: unit };
    } else if (unitType === 'g' || unitType === 'gram') {
      return { quantity: (count * unitQuantity) / 1000, type: 'kg', originalUnit: unit };
    } else if (unitType === 'kg') {
      return { quantity: count * unitQuantity, type: 'kg', originalUnit: unit };
    }
  }

  return { quantity: 1, type: 'unknown', originalUnit: unit };
}

/**
 * Calculate the unit price (price per kg or liter)
 */
export function calculateUnitPrice(price: number, parsed: ParsedUnit | null): number | null {
  if (!parsed || parsed.type === 'unknown' || parsed.type === 'stuk' || parsed.quantity === 0) {
    return null;
  }

  return price / parsed.quantity;
}

/**
 * Format unit price for display
 */
export function formatUnitPrice(unitPrice: number | null, unitType: UnitType): string | null {
  if (unitPrice === null) return null;

  const formatted = new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(unitPrice);

  switch (unitType) {
    case 'kg':
      return `${formatted}/kg`;
    case 'liter':
      return `${formatted}/L`;
    default:
      return null;
  }
}

/**
 * Get the unit price display string from a product price and unit
 */
export function getUnitPriceDisplay(price: number, unit: string | null | undefined): string | null {
  const parsed = parseUnitString(unit);
  if (!parsed) return null;

  const unitPrice = calculateUnitPrice(price, parsed);
  return formatUnitPrice(unitPrice, parsed.type);
}
