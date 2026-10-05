import { convertCreatineGoal, convertWaterGoal } from '../measurement';

describe('measurement goal conversions', () => {
   it('keeps the same water quantity when switching between ounces and milliliters', () => {
      const milliliters = convertWaterGoal(64, 'oz', 'ml');
      expect(milliliters).toBeCloseTo(1892.704);
      expect(convertWaterGoal(milliliters, 'ml', 'oz')).toBeCloseTo(64);
   });

   it('keeps the same creatine quantity when switching between grams and milligrams', () => {
      expect(convertCreatineGoal(5, 'g', 'mg')).toBe(5000);
      expect(convertCreatineGoal(5000, 'mg', 'g')).toBe(5);
   });

   it('leaves values unchanged when units do not match a supported conversion', () => {
      expect(convertWaterGoal(32, 'ml', 'ml')).toBe(32);
      expect(convertCreatineGoal(4, 'g', 'oz')).toBe(4);
   });
});
