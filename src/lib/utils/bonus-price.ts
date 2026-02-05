export interface BonusDeal {
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  savingsPercent: number;
}

/**
 * Parse a Dutch bonus mechanism string and calculate the effective per-unit price.
 * Returns null for unrecognized mechanisms.
 */
export function calculateBonusDeal(mechanism: string, price: number): BonusDeal | null {
  const m = mechanism.trim();

  // "1 + 1 gratis", "3 + 1 gratis" — buy X+Y, pay X (API uses spaces around +)
  const plusGratisMatch = m.match(/^(\d+)\s*\+\s*(\d+)\s+gratis$/i);
  if (plusGratisMatch) {
    const pay = parseInt(plusGratisMatch[1], 10);
    const free = parseInt(plusGratisMatch[2], 10);
    const quantity = pay + free;
    const totalPrice = price * pay;
    const unitPrice = totalPrice / quantity;
    const savingsPercent = (1 - unitPrice / price) * 100;
    return { unitPrice, quantity, totalPrice, savingsPercent };
  }

  // "2e Halve Prijs" — 2nd at 50%
  const halvePrijsMatch = m.match(/^2e\s+halve\s+prijs$/i);
  if (halvePrijsMatch) {
    const quantity = 2;
    const totalPrice = price + price * 0.5;
    const unitPrice = totalPrice / quantity;
    const savingsPercent = (1 - unitPrice / price) * 100;
    return { unitPrice, quantity, totalPrice, savingsPercent };
  }

  // "2e Gratis" — 2nd free
  const tweedeGratisMatch = m.match(/^2e\s+gratis$/i);
  if (tweedeGratisMatch) {
    const quantity = 2;
    const totalPrice = price;
    const unitPrice = totalPrice / quantity;
    const savingsPercent = (1 - unitPrice / price) * 100;
    return { unitPrice, quantity, totalPrice, savingsPercent };
  }

  // "2 voor 5.50", "2 VOOR 12.99" — N for X
  const nVoorMatch = m.match(/^(\d+)\s+voor\s+(\d+[.,]\d{2})$/i);
  if (nVoorMatch) {
    const quantity = parseInt(nVoorMatch[1], 10);
    const totalPrice = parseFloat(nVoorMatch[2].replace(',', '.'));
    const unitPrice = totalPrice / quantity;
    const savingsPercent = (1 - unitPrice / price) * 100;
    return { unitPrice, quantity, totalPrice, savingsPercent };
  }

  // "VOOR 8.49" — single item deal price
  const voorMatch = m.match(/^voor\s+(\d+[.,]\d{2})$/i);
  if (voorMatch) {
    const unitPrice = parseFloat(voorMatch[1].replace(',', '.'));
    const savingsPercent = (1 - unitPrice / price) * 100;
    return { unitPrice, quantity: 1, totalPrice: unitPrice, savingsPercent };
  }

  // "25% korting", "30% korting"
  const kortingMatch = m.match(/^(\d+(?:[.,]\d+)?)%\s+korting$/i);
  if (kortingMatch) {
    const percent = parseFloat(kortingMatch[1].replace(',', '.'));
    const unitPrice = price * (1 - percent / 100);
    return { unitPrice, quantity: 1, totalPrice: unitPrice, savingsPercent: percent };
  }

  // "5% volume voordeel", "13.5% volume voordeel"
  const volumeMatch = m.match(/^(\d+(?:[.,]\d+)?)%\s+volume\s+voordeel$/i);
  if (volumeMatch) {
    const percent = parseFloat(volumeMatch[1].replace(',', '.'));
    const unitPrice = price * (1 - percent / 100);
    return { unitPrice, quantity: 1, totalPrice: unitPrice, savingsPercent: percent };
  }

  return null;
}
