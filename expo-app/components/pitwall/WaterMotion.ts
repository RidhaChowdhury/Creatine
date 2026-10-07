export type WaterImpulse = { id: number; origin: number };
export function waterSurface(width: number, height: number, level: number, time: number, age: number, origin: number, reduced: boolean) {
  'worklet';
  const progress = Math.max(0, Math.min(level, 1));
  // A shallow surface remains visible at zero; the displayed value stays exactly zero.
  const meanY = Math.min(height - Math.min(24, height * .04), height * (1 - progress));
  const energy = reduced ? 0 : Math.exp(-Math.max(0, age) / 500);
  const phase = reduced ? 0 : time / 8200;
  const points = Array.from({ length: 49 }, (_, index) => {
    const fraction = index / 48;
    const distance = fraction - origin;
    const idle = Math.sin((fraction - phase) * Math.PI * 2) * 12;
    const ripple = 18 * energy * Math.cos(distance * 18 - age * .009) * Math.exp(-Math.abs(distance) * 2);
    return { x: fraction * width, y: Math.max(0, Math.min(height, meanY + idle + ripple)) };
  });
  return { points, meanY };
}
