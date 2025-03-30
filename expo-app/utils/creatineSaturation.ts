export type CreatineLogEntry = {
  date: string;
  doseGrams: number; // Actual grams consumed that day
};

// utils/creatineSaturation.ts
export const calculateSaturation = (logs: CreatineLogEntry[]): number[] => {
  const saturations: number[] = [];
  const loadingRate = 0.25; // Increased absorption rate during loading
  const maintenanceRate = 0.15; // Base absorption rate
  const decayRate = 0.01; // Slightly increased decay rate

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

export const calculateDaysTillSaturated = (
  currentSaturation: number,
  plannedDailyDose: number = 5 // Default maintenance dose
): number => {
  const TARGET_SATURATION = 0.90;
  const DAILY_DECAY = 0.005;

  // Determine absorption parameters based on dose
  const isLoadingPhase = plannedDailyDose >= 15;
  const rate = isLoadingPhase ? 0.25 : 0.15;
  const effectiveDose = isLoadingPhase
    ? Math.min(plannedDailyDose, 20) / 20
    : Math.min(plannedDailyDose, 5) / 5;

  let days = 0;
  let saturation = currentSaturation;

  while (saturation < TARGET_SATURATION && days < 30) {
    // Max 30 day cap
    days++;

    // Calculate next day's saturation
    saturation = saturation * (1 - DAILY_DECAY); // First apply decay
    if (plannedDailyDose > 0) {
      saturation = Math.min(
        saturation + rate * effectiveDose * (1 - saturation),
        1
      );
    }
  }

  return days > 30 ? 30 : days; // Return capped value
};