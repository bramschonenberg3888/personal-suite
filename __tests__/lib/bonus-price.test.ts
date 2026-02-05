import { describe, it, expect } from 'vitest';
import { calculateBonusDeal } from '@/lib/utils/bonus-price';

describe('calculateBonusDeal', () => {
  describe('X + Y gratis (with spaces around +)', () => {
    it('should calculate 1 + 1 gratis', () => {
      const result = calculateBonusDeal('1 + 1 gratis', 1.99);
      expect(result).not.toBeNull();
      expect(result!.quantity).toBe(2);
      expect(result!.totalPrice).toBe(1.99);
      expect(result!.unitPrice).toBeCloseTo(0.995);
      expect(result!.savingsPercent).toBeCloseTo(50);
    });

    it('should calculate 3 + 1 gratis', () => {
      const result = calculateBonusDeal('3 + 1 gratis', 2.45);
      expect(result).not.toBeNull();
      expect(result!.quantity).toBe(4);
      expect(result!.totalPrice).toBeCloseTo(7.35);
      expect(result!.unitPrice).toBeCloseTo(1.8375);
      expect(result!.savingsPercent).toBeCloseTo(25);
    });

    it('should handle no spaces around +', () => {
      const result = calculateBonusDeal('1+1 gratis', 4.0);
      expect(result).not.toBeNull();
      expect(result!.unitPrice).toBe(2.0);
    });
  });

  describe('2e Halve Prijs', () => {
    it('should calculate 2e Halve Prijs', () => {
      const result = calculateBonusDeal('2e Halve Prijs', 11.99);
      expect(result).not.toBeNull();
      expect(result!.quantity).toBe(2);
      expect(result!.totalPrice).toBeCloseTo(17.985);
      expect(result!.unitPrice).toBeCloseTo(8.9925);
      expect(result!.savingsPercent).toBeCloseTo(25);
    });
  });

  describe('2e Gratis', () => {
    it('should calculate 2e Gratis', () => {
      const result = calculateBonusDeal('2e Gratis', 6.0);
      expect(result).not.toBeNull();
      expect(result!.quantity).toBe(2);
      expect(result!.totalPrice).toBe(6.0);
      expect(result!.unitPrice).toBe(3.0);
      expect(result!.savingsPercent).toBeCloseTo(50);
    });
  });

  describe('N voor X.XX', () => {
    it('should calculate 2 voor 5.50', () => {
      const result = calculateBonusDeal('2 voor 5.50', 3.09);
      expect(result).not.toBeNull();
      expect(result!.quantity).toBe(2);
      expect(result!.totalPrice).toBe(5.5);
      expect(result!.unitPrice).toBe(2.75);
    });

    it('should handle uppercase VOOR', () => {
      const result = calculateBonusDeal('2 VOOR 12.99', 8.49);
      expect(result).not.toBeNull();
      expect(result!.quantity).toBe(2);
      expect(result!.totalPrice).toBe(12.99);
      expect(result!.unitPrice).toBeCloseTo(6.495);
    });

    it('should handle comma as decimal separator', () => {
      const result = calculateBonusDeal('3 voor 10,00', 4.0);
      expect(result).not.toBeNull();
      expect(result!.totalPrice).toBe(10.0);
      expect(result!.unitPrice).toBeCloseTo(3.333, 2);
    });
  });

  describe('VOOR X.XX (single item deal price)', () => {
    it('should calculate VOOR 8.49', () => {
      const result = calculateBonusDeal('VOOR 8.49', 8.49);
      expect(result).not.toBeNull();
      expect(result!.quantity).toBe(1);
      expect(result!.unitPrice).toBe(8.49);
    });

    it('should calculate savings when original price is higher', () => {
      const result = calculateBonusDeal('VOOR 8.49', 10.0);
      expect(result).not.toBeNull();
      expect(result!.unitPrice).toBe(8.49);
      expect(result!.savingsPercent).toBeCloseTo(15.1);
    });
  });

  describe('X% korting', () => {
    it('should calculate 25% korting', () => {
      const result = calculateBonusDeal('25% korting', 17.99);
      expect(result).not.toBeNull();
      expect(result!.quantity).toBe(1);
      expect(result!.unitPrice).toBeCloseTo(13.4925);
      expect(result!.savingsPercent).toBe(25);
    });

    it('should calculate 30% korting', () => {
      const result = calculateBonusDeal('30% korting', 4.89);
      expect(result).not.toBeNull();
      expect(result!.unitPrice).toBeCloseTo(3.423);
      expect(result!.savingsPercent).toBe(30);
    });
  });

  describe('X% volume voordeel', () => {
    it('should calculate 5% volume voordeel', () => {
      const result = calculateBonusDeal('5% volume voordeel', 49.32);
      expect(result).not.toBeNull();
      expect(result!.unitPrice).toBeCloseTo(46.854);
      expect(result!.savingsPercent).toBe(5);
    });

    it('should calculate 13.5% volume voordeel', () => {
      const result = calculateBonusDeal('13.5% volume voordeel', 10.0);
      expect(result).not.toBeNull();
      expect(result!.unitPrice).toBeCloseTo(8.65);
      expect(result!.savingsPercent).toBe(13.5);
    });
  });

  describe('unrecognized mechanisms', () => {
    it('should return null for unknown patterns', () => {
      expect(calculateBonusDeal('Bonus voordeel', 5.0)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(calculateBonusDeal('', 5.0)).toBeNull();
    });
  });
});
