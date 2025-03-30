export type CreatineLogEntry = {
  date: string;
  doseGrams: number; // Actual grams consumed that day
};

// utils/creatineSaturation.ts
export const calculateSaturation = (logs: CreatineLogEntry[]): number[] => {
  const saturations: number[] = [];
  const loadingRate = 0.25; // Increased absorption rate during loading
  const maintenanceRate = 0.15; // Base absorption rate
  const decayRate = 0.03; // Slightly increased decay rate

  logs.forEach((entry, i) => {
    const dose = entry.doseGrams;
    const isLoadingPhase = dose >= 15; // Consider doses ≥15g as loading phase

    if (i === 0) {
      // Initial dose has stronger effect
      saturations[i] = dose > 0 
        ? Math.min(0.3, dose * 0.06) // 5g = 0.3, 20g = 1.2 (capped at 0.3)
        : 0;
    } else {
      const prev = saturations[i - 1];
      if (dose > 0) {
        const rate = isLoadingPhase ? loadingRate : maintenanceRate;
        const effectiveDose = isLoadingPhase 
          ? Math.min(dose, 20) / 20 
          : Math.min(dose, 5) / 5;
        
        saturations[i] = Math.min(
          prev + (rate * effectiveDose * (1 - prev)), 
          1
        );
      } else {
        saturations[i] = prev * (1 - decayRate);
      }
    }
  });

  return saturations;
};