export type PerformanceWeights = {
   creatine: number;
   hydration: number;
};

export type PerformanceOptions = {
   /**
    * How to combine creatine and hydration saturations (both in range 0-1).
    * arithmetic: wC*c + wH*h (default)
    * geometric:  c^wC * h^wH (penalizes low values more)
    */
   mode?: 'arithmetic' | 'geometric';
   /** Optional weights; will be normalized to sum=1. Defaults to equal weights. */
   weights?: PerformanceWeights;
   /** Clamp each output to [0,1]. Default true. */
   clamp?: boolean;
};

/**
 * Calculate a composite performance metric from two saturation series.
 * Inputs are arrays of daily saturation fractions in [0,1].
 * Returns an array of the same length (aligned to the overlapping tail if lengths differ).
 */
export function calculatePerformanceMetric(
   creatine: number[],
   hydration: number[],
   opts: PerformanceOptions = {}
): number[] {
   const { mode = 'arithmetic', clamp = true } = opts;
   const w = normalizeWeights(opts.weights ?? { creatine: 0.5, hydration: 0.5 });

   if (!Array.isArray(creatine) || !Array.isArray(hydration)) return [];
   if (creatine.length === 0 || hydration.length === 0) return [];

   // Align to overlapping tail if lengths differ
   const n = Math.min(creatine.length, hydration.length);
   const c = creatine.slice(creatine.length - n);
   const h = hydration.slice(hydration.length - n);

   const out: number[] = new Array(n);
   for (let i = 0; i < n; i++) {
      const ci = safe01(c[i]);
      const hi = safe01(h[i]);
      let v: number;
      if (mode === 'geometric') {
         // Avoid 0^w by flooring at small epsilon
         const eps = 1e-6;
         v = Math.pow(Math.max(ci, eps), w.creatine) * Math.pow(Math.max(hi, eps), w.hydration);
      } else {
         v = w.creatine * ci + w.hydration * hi;
      }
      out[i] = clamp ? clamp01(v) : v;
   }
   return out;
}

function normalizeWeights(w: PerformanceWeights): PerformanceWeights {
   const sum = (w.creatine ?? 0) + (w.hydration ?? 0);
   if (sum <= 0) return { creatine: 0.5, hydration: 0.5 };
   return { creatine: (w.creatine ?? 0) / sum, hydration: (w.hydration ?? 0) / sum };
}

function clamp01(x: number) {
   if (Number.isNaN(x) || !Number.isFinite(x)) return 0;
   return Math.max(0, Math.min(1, x));
}

function safe01(x: number) {
   if (Number.isNaN(x) || !Number.isFinite(x)) return 0;
   return x < 0 ? 0 : x > 1 ? 1 : x;
}
