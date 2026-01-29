import { describe, it, expect } from 'vitest';
import { getGroupUnitInfo, getUnitPriceForSort } from '@/lib/utils/unit-price';

describe('getGroupUnitInfo', () => {
  it('should identify all-weight group as comparable /kg', () => {
    const result = getGroupUnitInfo([
      { id: '1', price: 20.99, unit: '1000g' },
      { id: '2', price: 11.49, unit: '500g' },
    ]);

    expect(result.canCompare).toBe(true);
    expect(result.commonType).toBe('kg');
    expect(result.unitLabel).toBe('/kg');
    expect(result.products).toHaveLength(2);
    // 20.99 / 1 kg = 20.99
    expect(result.products[0].unitPrice).toBeCloseTo(20.99);
    // 11.49 / 0.5 kg = 22.98
    expect(result.products[1].unitPrice).toBeCloseTo(22.98);
  });

  it('should identify all-volume group as comparable /L', () => {
    const result = getGroupUnitInfo([
      { id: '1', price: 2.5, unit: '1L' },
      { id: '2', price: 1.8, unit: '500ml' },
    ]);

    expect(result.canCompare).toBe(true);
    expect(result.commonType).toBe('liter');
    expect(result.unitLabel).toBe('/L');
    // 2.5 / 1 = 2.50
    expect(result.products[0].unitPrice).toBeCloseTo(2.5);
    // 1.8 / 0.5 = 3.60
    expect(result.products[1].unitPrice).toBeCloseTo(3.6);
  });

  it('should mark mixed weight+volume as not comparable', () => {
    const result = getGroupUnitInfo([
      { id: '1', price: 5.0, unit: '500g' },
      { id: '2', price: 3.0, unit: '1L' },
    ]);

    expect(result.canCompare).toBe(false);
    expect(result.commonType).toBe('mixed');
    expect(result.unitLabel).toBeNull();
  });

  it('should mark all-stuk group as not comparable', () => {
    const result = getGroupUnitInfo([
      { id: '1', price: 2.0, unit: 'per stuk' },
      { id: '2', price: 3.0, unit: '1 stuk' },
    ]);

    expect(result.canCompare).toBe(false);
    expect(result.commonType).toBe('stuk');
    expect(result.unitLabel).toBeNull();
  });

  it('should handle products with missing units', () => {
    const result = getGroupUnitInfo([
      { id: '1', price: 10.0, unit: '500g' },
      { id: '2', price: 8.0, unit: null },
    ]);

    // Still comparable because at least one product has measurable type
    expect(result.canCompare).toBe(true);
    expect(result.commonType).toBe('kg');
    // Product with null unit gets null unitPrice
    expect(result.products[0].unitPrice).toBeCloseTo(20.0);
    expect(result.products[1].unitPrice).toBeNull();
  });

  it('should handle all-null units as not comparable', () => {
    const result = getGroupUnitInfo([
      { id: '1', price: 5.0, unit: null },
      { id: '2', price: 3.0, unit: undefined },
    ]);

    expect(result.canCompare).toBe(false);
    expect(result.commonType).toBe('stuk');
  });

  it('should handle combined format like "6 x 330ml"', () => {
    const result = getGroupUnitInfo([
      { id: '1', price: 5.94, unit: '6 x 330ml' },
      { id: '2', price: 3.99, unit: '1.5L' },
    ]);

    expect(result.canCompare).toBe(true);
    expect(result.commonType).toBe('liter');
    // parseUnitString matches the volume regex (330ml → 0.33L) before the
    // combined format regex, so: 5.94 / 0.33 = 18.0
    expect(result.products[0].unitPrice).toBeCloseTo(18.0);
    // 3.99 / 1.5 = 2.66
    expect(result.products[1].unitPrice).toBeCloseTo(2.66);
  });

  it('should handle kg units directly', () => {
    const result = getGroupUnitInfo([
      { id: '1', price: 12.0, unit: '2kg' },
      { id: '2', price: 7.0, unit: '1kg' },
    ]);

    expect(result.canCompare).toBe(true);
    // 12 / 2 = 6.0
    expect(result.products[0].unitPrice).toBeCloseTo(6.0);
    // 7 / 1 = 7.0
    expect(result.products[1].unitPrice).toBeCloseTo(7.0);
  });

  it('should fall back to extracting units from product name when unit is "pieces"', () => {
    // Real Jumbo data: unit is "pieces" but name contains "1000 g" or "500 g"
    const result = getGroupUnitInfo([
      {
        id: '1',
        price: 20.99,
        unit: 'pieces',
        name: 'Douwe Egberts Intens Bonen Voordeelpak 1000 g',
      },
      {
        id: '2',
        price: 11.49,
        unit: 'pieces',
        name: 'Douwe Egberts Intens Koffiebonen 500 g',
      },
      { id: '3', price: 20.99, unit: '1 kg', name: 'Douwe Egberts Intens koffiebonen voordeelpak' },
      { id: '4', price: 11.49, unit: '500 g', name: 'Douwe Egberts Intens koffiebonen' },
    ]);

    expect(result.canCompare).toBe(true);
    expect(result.commonType).toBe('kg');
    // All four should have unit prices: price / kg
    expect(result.products[0].unitPrice).toBeCloseTo(20.99); // 20.99 / 1kg
    expect(result.products[1].unitPrice).toBeCloseTo(22.98); // 11.49 / 0.5kg
    expect(result.products[2].unitPrice).toBeCloseTo(20.99); // 20.99 / 1kg
    expect(result.products[3].unitPrice).toBeCloseTo(22.98); // 11.49 / 0.5kg
  });

  it('should not fall back to name when unit is already measurable', () => {
    const result = getGroupUnitInfo([
      { id: '1', price: 5.0, unit: '500g', name: 'Product with 1kg in name' },
    ]);

    // Should use the unit field (500g), not the name (1kg)
    expect(result.products[0].unitPrice).toBeCloseTo(10.0); // 5.0 / 0.5kg
  });
});

describe('getUnitPriceForSort', () => {
  it('should return unit price for weight product', () => {
    // 10.0 / 0.5kg = 20.0
    expect(getUnitPriceForSort(10.0, '500g')).toBeCloseTo(20.0);
  });

  it('should return unit price for volume product', () => {
    // 3.0 / 1.5L = 2.0
    expect(getUnitPriceForSort(3.0, '1.5L')).toBeCloseTo(2.0);
  });

  it('should return Infinity for null unit', () => {
    expect(getUnitPriceForSort(5.0, null)).toBe(Infinity);
  });

  it('should return Infinity for stuk unit', () => {
    expect(getUnitPriceForSort(5.0, 'per stuk')).toBe(Infinity);
  });

  it('should return Infinity for unknown unit', () => {
    expect(getUnitPriceForSort(5.0, 'some random text')).toBe(Infinity);
  });

  it('should return Infinity for undefined unit', () => {
    expect(getUnitPriceForSort(5.0, undefined)).toBe(Infinity);
  });

  it('should fall back to name when unit is unhelpful', () => {
    // 20.99 / 1kg = 20.99
    expect(getUnitPriceForSort(20.99, 'pieces', 'Douwe Egberts 1000 g')).toBeCloseTo(20.99);
  });
});
