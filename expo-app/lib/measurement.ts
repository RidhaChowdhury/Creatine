const MILLILITERS_PER_FLUID_OUNCE = 29.5735;

export function convertWaterGoal(value: number, from: string, to: string): number {
   if (from === to) return value;
   if (from === 'oz' && to === 'ml') return value * MILLILITERS_PER_FLUID_OUNCE;
   if (from === 'ml' && to === 'oz') return value / MILLILITERS_PER_FLUID_OUNCE;
   return value;
}

export function convertCreatineGoal(value: number, from: string, to: string): number {
   if (from === to) return value;
   if (from === 'g' && to === 'mg') return value * 1000;
   if (from === 'mg' && to === 'g') return value / 1000;
   return value;
}
