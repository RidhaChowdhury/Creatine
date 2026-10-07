import { waterSurface } from '../WaterMotion';

describe('waterSurface', () => {
   it('keeps reduced motion static across time and impulse origins', () => {
      const first = waterSurface(240, 100, 0.42, 0, 0, 0.2, true);
      const later = waterSurface(240, 100, 0.42, 37_500, 2_400, 0.85, true);

      expect(later).toEqual(first);
      expect(first.points).toHaveLength(49);
   });

   it('shares a 49 point surface geometry with exact endpoints and clamped empty/full levels', () => {
      const partial = waterSurface(320, 160, 0.5, 120, 0, 0.5, true);
      const empty = waterSurface(320, 160, 0, 0, 0, 0.5, false);
      const belowEmpty = waterSurface(320, 160, -0.4, 0, 0, 0.5, false);
      const full = waterSurface(320, 160, 1, 0, 0, 0.5, false);
      const aboveFull = waterSurface(320, 160, 1.4, 0, 0, 0.5, false);

      expect(partial.points).toHaveLength(49);
      expect(partial.points[0].x).toBe(0);
      expect(partial.points.at(-1)?.x).toBe(320);
      expect(partial.meanY).toBe(80);
      expect(belowEmpty).toEqual(empty);
      expect(aboveFull).toEqual(full);
      expect(empty.meanY).toBeCloseTo(153.6);
      expect(empty.points.some((point) => point.y < 160)).toBe(true);
      expect(full.meanY).toBe(0);
      expect(full.points.every((point) => point.y >= 0 && point.y <= 30)).toBe(true);
   });

   it('localizes the entry ripple, lets it decay, and keeps the slow idle wave', () => {
      const width = 240;
      const height = 100;
      const baseline = waterSurface(width, height, 0.5, 0, 100_000, 0.5, false);
      const impulse = waterSurface(width, height, 0.5, 0, 0, 0.5, false);
      const decayed = waterSurface(width, height, 0.5, 0, 1_500, 0.5, false);
      const deviationAt = (points: typeof baseline.points, index: number) => Math.abs(points[index].y - baseline.points[index].y);

      expect(deviationAt(impulse.points, 24)).toBeGreaterThan(deviationAt(impulse.points, 0));
      expect(deviationAt(decayed.points, 24)).toBeLessThan(deviationAt(impulse.points, 24) * 0.2);

      const quarterCycle = waterSurface(width, height, 0.5, 2_050, 100_000, 0.1, false);
      const fullCycle = waterSurface(width, height, 0.5, 8_200, 100_000, 0.9, false);
      expect(quarterCycle.points[12].y).not.toBeCloseTo(baseline.points[12].y, 1);
      fullCycle.points.forEach((point, index) => expect(point.y).toBeCloseTo(baseline.points[index].y, 10));
   });
});
