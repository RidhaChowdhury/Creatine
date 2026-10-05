/** Exact definitions for new Drops records. Legacy conversion functions remain unchanged. */
const units: Record<string, { dimension: string; factor: number }> = {
  oz: { dimension: 'volume', factor: 29.5735295625 },
  ml: { dimension: 'volume', factor: 1 },
  mL: { dimension: 'volume', factor: 1 },
  L: { dimension: 'volume', factor: 1000 },
  cup: { dimension: 'volume', factor: 240 },
  tsp: { dimension: 'volume', factor: 4.92892159375 },
  tbsp: { dimension: 'volume', factor: 14.78676478125 },
  g: { dimension: 'mass', factor: 1000 },
  mg: { dimension: 'mass', factor: 1 },
};
export function compatibleUnits(unit: string): string[] {
  const definition = units[unit];
  return definition ? Object.keys(units).filter(key => units[key].dimension === definition.dimension && key !== 'ml') : [unit];
}
export function convertAmount(value: number, from: string, to: string): number {
  if (!Number.isFinite(value)) throw new Error('Amount must be finite.');
  if (!from.trim() || !to.trim()) throw new Error('Unit is required.');
  if (from === to) return value;
  const a = units[from], b = units[to];
  if (!a || !b || a.dimension !== b.dimension) throw new Error(`Cannot convert ${from} to ${to}.`);
  return value * a.factor / b.factor;
}
