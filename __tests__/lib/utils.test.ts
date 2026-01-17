import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn (className utility)', () => {
  describe('basic class handling', () => {
    it('should return empty string when called with no arguments', () => {
      expect(cn()).toBe('');
    });

    it('should return a single class unchanged', () => {
      expect(cn('text-red-500')).toBe('text-red-500');
    });

    it('should merge multiple classes', () => {
      expect(cn('p-4', 'm-2')).toBe('p-4 m-2');
    });

    it('should handle space-separated classes in a single string', () => {
      expect(cn('p-4 m-2 text-center')).toBe('p-4 m-2 text-center');
    });
  });

  describe('Tailwind class conflict resolution', () => {
    it('should resolve conflicting padding classes (last wins)', () => {
      expect(cn('p-4', 'p-8')).toBe('p-8');
    });

    it('should resolve conflicting margin classes', () => {
      expect(cn('m-2', 'm-4')).toBe('m-4');
    });

    it('should resolve conflicting text color classes', () => {
      expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
    });

    it('should resolve conflicting background color classes', () => {
      expect(cn('bg-white', 'bg-black')).toBe('bg-black');
    });

    it('should resolve conflicting width classes', () => {
      expect(cn('w-full', 'w-1/2')).toBe('w-1/2');
    });

    it('should resolve conflicting height classes', () => {
      expect(cn('h-screen', 'h-64')).toBe('h-64');
    });

    it('should resolve conflicting flex direction classes', () => {
      expect(cn('flex-row', 'flex-col')).toBe('flex-col');
    });

    it('should resolve conflicting font size classes', () => {
      expect(cn('text-sm', 'text-lg')).toBe('text-lg');
    });

    it('should resolve conflicting font weight classes', () => {
      expect(cn('font-normal', 'font-bold')).toBe('font-bold');
    });

    it('should keep non-conflicting classes from same category', () => {
      expect(cn('px-4', 'py-2')).toBe('px-4 py-2');
    });

    it('should handle complex conflict resolution', () => {
      expect(cn('p-4', 'px-2')).toBe('p-4 px-2');
    });
  });

  describe('falsy and undefined values', () => {
    it('should ignore undefined values', () => {
      expect(cn('p-4', undefined, 'm-2')).toBe('p-4 m-2');
    });

    it('should ignore null values', () => {
      expect(cn('p-4', null, 'm-2')).toBe('p-4 m-2');
    });

    it('should ignore false values', () => {
      expect(cn('p-4', false, 'm-2')).toBe('p-4 m-2');
    });

    it('should ignore empty strings', () => {
      expect(cn('p-4', '', 'm-2')).toBe('p-4 m-2');
    });

    it('should ignore 0 values', () => {
      expect(cn('p-4', 0, 'm-2')).toBe('p-4 m-2');
    });

    it('should handle multiple falsy values', () => {
      expect(cn(undefined, null, false, '', 0, 'text-center')).toBe('text-center');
    });

    it('should return empty string when all values are falsy', () => {
      expect(cn(undefined, null, false, '')).toBe('');
    });
  });

  describe('conditional classes with objects', () => {
    it('should include class when condition is true', () => {
      expect(cn({ 'bg-red-500': true })).toBe('bg-red-500');
    });

    it('should exclude class when condition is false', () => {
      expect(cn({ 'bg-red-500': false })).toBe('');
    });

    it('should handle mixed true/false conditions', () => {
      const result = cn({
        'bg-red-500': true,
        'text-white': true,
        hidden: false,
      });
      expect(result).toBe('bg-red-500 text-white');
    });

    it('should combine objects with strings', () => {
      expect(cn('p-4', { 'bg-blue-500': true, hidden: false })).toBe('p-4 bg-blue-500');
    });

    it('should resolve conflicts between object and string classes', () => {
      expect(cn('bg-red-500', { 'bg-blue-500': true })).toBe('bg-blue-500');
    });

    it('should handle truthy non-boolean values', () => {
      expect(cn({ 'text-center': 1 })).toBe('text-center');
      expect(cn({ 'text-center': 'yes' })).toBe('text-center');
    });

    it('should handle falsy non-boolean values', () => {
      expect(cn({ 'text-center': 0 })).toBe('');
      expect(cn({ 'text-center': '' })).toBe('');
      expect(cn({ 'text-center': null })).toBe('');
    });
  });

  describe('array inputs', () => {
    it('should handle array of classes', () => {
      expect(cn(['p-4', 'm-2'])).toBe('p-4 m-2');
    });

    it('should handle nested arrays', () => {
      expect(cn(['p-4', ['m-2', 'text-center']])).toBe('p-4 m-2 text-center');
    });

    it('should handle empty arrays', () => {
      expect(cn([])).toBe('');
    });

    it('should handle arrays with falsy values', () => {
      expect(cn(['p-4', undefined, null, 'm-2'])).toBe('p-4 m-2');
    });

    it('should combine arrays with other arguments', () => {
      expect(cn('text-lg', ['p-4', 'm-2'], 'bg-white')).toBe('text-lg p-4 m-2 bg-white');
    });

    it('should resolve conflicts within arrays', () => {
      expect(cn(['p-4', 'p-8'])).toBe('p-8');
    });

    it('should resolve conflicts between array and non-array', () => {
      expect(cn('p-4', ['p-8'])).toBe('p-8');
    });
  });

  describe('complex combinations', () => {
    it('should handle mix of strings, arrays, and objects', () => {
      const result = cn('base-class', ['array-class-1', 'array-class-2'], {
        'conditional-class': true,
        'excluded-class': false,
      });
      expect(result).toBe('base-class array-class-1 array-class-2 conditional-class');
    });

    it('should handle deeply nested structures', () => {
      const result = cn('p-4', ['m-2', ['text-center', { 'font-bold': true }]], {
        'bg-white': true,
      });
      expect(result).toBe('p-4 m-2 text-center font-bold bg-white');
    });

    it('should handle realistic component class patterns', () => {
      const isActive = true;
      const isDisabled = false;
      // Use a function to prevent TypeScript from narrowing the type
      const getSize = (): 'sm' | 'lg' => 'lg';
      const size = getSize();

      const result = cn(
        'inline-flex items-center justify-center rounded-md',
        'text-sm font-medium transition-colors',
        isActive && 'bg-primary text-primary-foreground',
        isDisabled && 'opacity-50 cursor-not-allowed',
        size === 'sm' && 'h-8 px-3',
        size === 'lg' && 'h-11 px-8'
      );

      expect(result).toContain('inline-flex');
      expect(result).toContain('bg-primary');
      expect(result).toContain('h-11');
      expect(result).not.toContain('opacity-50');
      expect(result).not.toContain('h-8');
    });

    it('should handle responsive and state variants', () => {
      const result = cn('text-sm md:text-base lg:text-lg', 'hover:bg-gray-100 focus:ring-2');
      expect(result).toBe('text-sm md:text-base lg:text-lg hover:bg-gray-100 focus:ring-2');
    });

    it('should resolve responsive variant conflicts', () => {
      const result = cn('md:text-sm', 'md:text-lg');
      expect(result).toBe('md:text-lg');
    });

    it('should handle arbitrary values', () => {
      const result = cn('w-[100px]', 'h-[200px]');
      expect(result).toBe('w-[100px] h-[200px]');
    });

    it('should resolve arbitrary value conflicts', () => {
      const result = cn('w-[100px]', 'w-[200px]');
      expect(result).toBe('w-[200px]');
    });
  });

  describe('edge cases', () => {
    it('should handle very long class strings', () => {
      const classes = Array(100).fill('p-4').join(' ');
      const result = cn(classes);
      // After merging, should only have one p-4
      expect(result).toBe('p-4');
    });

    it('should handle classes with special characters', () => {
      expect(cn("before:content-['']")).toBe("before:content-['']");
    });

    it('should handle negative values', () => {
      expect(cn('-mt-4', '-ml-2')).toBe('-mt-4 -ml-2');
    });

    it('should resolve negative value conflicts', () => {
      expect(cn('-mt-4', '-mt-8')).toBe('-mt-8');
    });

    it('should handle important modifier', () => {
      expect(cn('!text-red-500')).toBe('!text-red-500');
    });

    it('should handle dark mode classes', () => {
      expect(cn('dark:bg-gray-800', 'dark:text-white')).toBe('dark:bg-gray-800 dark:text-white');
    });

    it('should resolve dark mode conflicts', () => {
      expect(cn('dark:bg-gray-800', 'dark:bg-gray-900')).toBe('dark:bg-gray-900');
    });
  });
});
