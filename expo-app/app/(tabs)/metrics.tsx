import { View, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect, useContext } from 'react';
import { Text } from '@/components/ui/text';
import { CalendarDays } from 'lucide-react-native';
import CombinedHistory from '@/components/CombinedHistory';
import { HistoryChart } from '@/components/IntakeLineChart';
import { calculateSaturation } from '@/utils/creatineSaturationModel';
import { calculateHydrationSaturation, UserProfile } from '@/utils/hydrationSaturationModel';
import { getAllMetrics } from '@/utils/consumptionMetrics';
import { calculatePerformanceMetric } from '@/utils/performanceMetricModel';
import {
   computeHydrationBucketsForDate,
   computeAverageHydrationBuckets
} from '@/utils/hydrationHabitsMetrics';
import SimpleBarChart from '@/components/SimpleBarChart';
import { useSelector } from 'react-redux';
import { selectWaterLogs, selectCreatineLogs } from '@/features/intake/intakeSlice';
import { RootState } from '@/store/store';

// Helper to prepare chart data for last N days
function getChartData(logs: { consumed_at: string; amount: number }[], days: number) {
   const today = new Date();
   today.setHours(0, 0, 0, 0);
   return Array.from({ length: days }, (_, i) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (days - 1) + i);
      const dateStr = date.toISOString().slice(0, 10);
      const totalAmount = logs
         .filter((d) => d.consumed_at.slice(0, 10) === dateStr)
         .reduce((sum, d) => sum + (d.amount || 0), 0);
      return {
         day: dateStr,
         amount: totalAmount
      };
   });
}
const Metrics = () => {
   const [openPage, setOpenPage] = useState<'creatine' | 'water'>('creatine');
   const [selectedMetric, setSelectedMetric] = useState<'hydration' | 'creatine'>('hydration');

   // Range states (days)
   const [waterRange, setWaterRange] = useState<number>(7);
   const [creatineRange, setCreatineRange] = useState<number>(7);
   const [hydrationSaturationRange, setHydrationSaturationRange] = useState<number>(7);
   const [creatineSaturationRange, setCreatineSaturationRange] = useState<number>(7);

   // Data selection
   const waterLogs = useSelector((state: RootState) => selectWaterLogs(state));
   const creatineLogs = useSelector((state: RootState) => selectCreatineLogs(state));
   const waterChartData = getChartData(waterLogs, waterRange);
   const creatineChartData = getChartData(creatineLogs, creatineRange);

   // --- Creatine Saturation (compute full 90-day series, then slice per selected range) ---
   const SATURATION_WINDOW_DAYS = 90;
   const today = new Date();
   today.setHours(0, 0, 0, 0);
   const saturationBaseEntries = Array.from({ length: SATURATION_WINDOW_DAYS }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (SATURATION_WINDOW_DAYS - 1) + i);
      const dateStr = d.toISOString().slice(0, 10);
      const totalDose = creatineLogs
         .filter((l) => l.consumed_at.slice(0, 10) === dateStr)
         .reduce((sum, l) => sum + (l.amount || 0), 0);
      return { date: dateStr, doseGrams: totalDose };
   });

   // Use heuristic saturation model (returns 0-1). Build full 90-day series once then slice.
   const saturationFractions = calculateSaturation(saturationBaseEntries); // length = 90
   const saturationFullSeries = saturationFractions.map((s, idx) => ({
      day: saturationBaseEntries[idx].date,
      amount: Math.round(s * 100)
   }));

   const saturationSeries = saturationFullSeries.slice(-creatineSaturationRange);

   // --- Hydration saturation (90-day series) ---
   const HYDRATION_WINDOW_DAYS = 90;
   const hydrationBaseEntries = Array.from({ length: HYDRATION_WINDOW_DAYS }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (HYDRATION_WINDOW_DAYS - 1) + i);
      const dateStr = d.toISOString().slice(0, 10);
      const totalMl = waterLogs
         .filter((l) => l.consumed_at.slice(0, 10) === dateStr)
         .reduce((sum, l) => sum + (l.amount || 0), 0);
      return { date: dateStr, amount: totalMl };
   });

   const settings = useSelector((state: RootState) => state.settings);
   const profile: UserProfile = {
      height: settings.height || 175,
      weight: settings.weight || 70,
      sex: settings.sex === 'female' ? 'female' : 'male'
   };

   const hydrationFractions = calculateHydrationSaturation(hydrationBaseEntries, profile);
   const hydrationFullSeries = hydrationFractions.map((f, idx) => ({
      day: hydrationBaseEntries[idx].date,
      amount: Math.round(f * 100)
   }));

   const hydrationSeries = hydrationFullSeries.slice(-hydrationSaturationRange);
   const hydrationLineColor = '#3B82F6';

   const saturationLineColor = '#805AD5';
   const performanceLineColor = '#F59E0B'; // amber-500
   const waterLineColor = '#4299E1';
   const creatineLineColor = '#48BB78';
   const habitsTodayColor = '#22C55E';
   const habitsAvgColor = '#A78BFA';

   const defaultYTicks = 5;

   const rangeOptions = [7, 30, 90];

   // ---- Aggregate Metrics ----
   const metrics = getAllMetrics({
      creatineLogs: creatineLogs as any, // already shape { consumed_at, amount }
      waterLogs: waterLogs as any,
      waterGoal: settings.water_goal || 0,
      periodDays: 30,
      windowDays: 30
   });

   // --- Composite Performance Metric (aligned to 90-day saturation series) ---
   const performanceFractions = calculatePerformanceMetric(
      saturationFractions,
      hydrationFractions,
      { mode: 'arithmetic', weights: { creatine: 0.6, hydration: 0.4 } }
   );
   // Map to percentages with the same date alignment as the tail of 90-day base series
   const perfFullSeries = performanceFractions.map((p, idx) => ({
      day: hydrationBaseEntries.slice(-performanceFractions.length)[idx].date,
      amount: Math.round(p * 100)
   }));
   const [performanceRange, setPerformanceRange] = useState<number>(7);
   const performanceSeries = perfFullSeries.slice(-performanceRange);

   // ---- Merge three series into one dataset for multi-line chart ----
   // Normalize to x = day index over last N days (we'll use the max selected range among the three)
   const mergedRange = Math.max(
      hydrationSaturationRange,
      creatineSaturationRange,
      performanceRange
   );
   const baseDays = hydrationBaseEntries.slice(-mergedRange).map((e) => e.date);

   // Build maps for quick lookup by day
   const mapHydration = new Map(hydrationFullSeries.map((d) => [d.day, d.amount]));
   const mapCreatineSat = new Map(saturationFullSeries.map((d) => [d.day, d.amount]));
   const mapPerformance = new Map(perfFullSeries.map((d) => [d.day, d.amount]));

   const mergedData = baseDays.map((day, i) => {
      const obj: any = { x: i, day };
      if (mapHydration.has(day)) obj.y0 = mapHydration.get(day);
      if (mapCreatineSat.has(day)) obj.y1 = mapCreatineSat.get(day);
      if (mapPerformance.has(day)) obj.y2 = mapPerformance.get(day);
      return obj;
   });

   // --- Hydration Habits (bucketed by time of day) ---
   const todayBuckets = computeHydrationBucketsForDate(waterLogs as any);
   const avgBuckets = computeAverageHydrationBuckets(waterLogs as any, 30);
   const habitsCombined = todayBuckets.labels.map((label, i) => ({
      label,
      today: todayBuckets.values[i],
      avg: avgBuckets.values[i] ?? 0
   }));

   const metricCards: { label: string; value: string }[] = [
      {
         label: 'Avg Dose Time',
         value: metrics.averageDoseTime.hhmm
      },
      {
         label: 'Avg Dose Time (30d)',
         value: metrics.averageDoseTimeWindow.hhmm
      },
      {
         label: 'Creatine Adherence (30d)',
         value: `${Math.round(metrics.creatineAdherence * 100)}%`
      },
      {
         label: 'Hydration Adherence (30d)',
         value: `${Math.round(metrics.hydrationAdherence * 100)}%`
      },
      {
         label: 'Creatine Streak',
         value: `${metrics.creatineStreak}d`
      },
      {
         label: 'Hydration Streak',
         value: `${metrics.hydrationStreak}d`
      },
      {
         label: 'Lifetime Creatine',
         value: `${metrics.totalCreatine.total.toFixed(1)}${settings.supplement_unit || 'g'}`
      },
      {
         label: 'Lifetime Water',
         value: `${Math.round(metrics.totalWater.total)}${settings.drink_unit || ''}`
      }
   ];

   return (
      <SafeAreaView className='bg-background-0 h-full'>
         <ScrollView
            showsVerticalScrollIndicator={false}
            className='px-[15]'>
            <View className='flex-row justify-between'>
               <View className='flex-row items-center pt-[10] px-[15]'>
                  <CalendarDays
                     color={'white'}
                     size={32}
                  />
                  <Text className='text-[20px] font-semibold pl-[7]'>History</Text>
               </View>
            </View>
            <View className='mb-4'>
               <CombinedHistory />
            </View>
            <View className='mb-6 px-2'>
               <Text className='text-[20px] text-white font-semibold mb-2 pl-[7] pr-[5]'>
                  Key Metrics
               </Text>
               <View className='flex-row flex-wrap -mx-2'>
                  {metricCards.map((m) => (
                     <View
                        key={m.label}
                        className='w-1/2 px-2 mb-4'>
                        <View className='bg-primary-0 rounded-lg p-3 h-24 justify-between'>
                           <Text
                              className='text-xs text-typography-500'
                              numberOfLines={2}>
                              {m.label}
                           </Text>
                           <Text className='text-2xl font-extrabold mt-1'>{m.value}</Text>
                        </View>
                     </View>
                  ))}
               </View>
            </View>
            <View className='mb-8 bg-primary-0 p-4 rounded-lg'>
               <HistoryChart
                  data={mergedData}
                  xKey='x'
                  yKeys={['y0', 'y1', 'y2']}
                  lines={[
                     { key: 'y0', color: hydrationLineColor, label: 'Hydration' },
                     { key: 'y1', color: saturationLineColor, label: 'Creatine' },
                     { key: 'y2', color: performanceLineColor, label: 'Performance' }
                  ]}
                  yMax={100}
                  yTickCount={defaultYTicks}
                  title={'Saturations'}
                  rangeOptions={rangeOptions}
                  currentRange={mergedRange}
                  onRangeChange={(r) => {
                     // Keep all three in sync for the shared chart
                     setHydrationSaturationRange(r);
                     setCreatineSaturationRange(r);
                     setPerformanceRange(r);
                  }}
                  height={220}
               />
            </View>
            <View className='mb-8 bg-primary-0 p-4 rounded-lg'>
               <SimpleBarChart
                  title='Hydration Habits'
                  data={habitsCombined}
                  height={220}
               />
            </View>
         </ScrollView>
      </SafeAreaView>
   );
};

export default Metrics;
