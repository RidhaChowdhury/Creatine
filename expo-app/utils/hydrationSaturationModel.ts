export type HydrationLogEntry = {
   date: string;
   amount: number; // Water intake in ounces
};

export type UserProfile = {
   height: number; // in inches
   weight: number; // in pounds
   sex: 'male' | 'female';
};

// Daily water requirement calculation based on NIH recommendations (converted to ounces)
const calculateDailyWaterRequirement = (user: UserProfile): number => {
   // Base requirement using weight-based calculation (0.5-0.67 oz per pound)
   const baseRequirement = user.weight * 0.6; // Middle of the range

   // Height adjustment (additional 0.4 oz per inch over 60 inches/5 feet)
   const heightAdjustment = Math.max(0, user.height - 60) * 0.4;

   // Sex-based adjustment (men typically need more)
   const sexAdjustment = user.sex === 'male' ? 10 : 0;

   return baseRequirement + heightAdjustment + sexAdjustment;
};

// Hydration saturation calculation with exponential decay
export const calculateHydrationSaturation = (
   logs: HydrationLogEntry[],
   user: UserProfile
): number[] => {
   const dailyRequirement = calculateDailyWaterRequirement(user);
   const saturations: number[] = [];
   const DECAY_RATE = 0.25; // Daily hydration loss rate

   logs.forEach((entry, i) => {
      const intakeRatio = Math.min(1.5, entry.amount / dailyRequirement);

      if (i === 0) {
         saturations[i] = intakeRatio > 1 ? 1 : intakeRatio;
      } else {
         const daysSinceLastEntry = Math.floor(
            (new Date(entry.date).getTime() - new Date(logs[i - 1].date).getTime()) /
               (1000 * 60 * 60 * 24)
         );

         const decayFactor = Math.pow(1 - DECAY_RATE, daysSinceLastEntry);
         const previousSaturation = saturations[i - 1] * decayFactor;

         saturations[i] = Math.min(1, previousSaturation + intakeRatio * (1 - previousSaturation));
      }
   });

   return saturations;
};

// Projection for optimal hydration
export const calculateDaysTillOptimalHydration = (
   currentSaturation: number,
   plannedDailyIntake: number, // in ounces
   user: UserProfile
): number => {
   const dailyRequirement = calculateDailyWaterRequirement(user);
   const intakeRatio = Math.min(1, plannedDailyIntake / dailyRequirement);
   const DECAY_RATE = 0.25;
   const TARGET_HYDRATION = 0.95;

   let days = 0;
   let saturation = currentSaturation;

   while (saturation < TARGET_HYDRATION && days < 14) {
      days++;
      saturation = saturation * (1 - DECAY_RATE);
      saturation = Math.min(1, saturation + intakeRatio * (1 - saturation));
   }

   return days > 14 ? 14 : days;
};