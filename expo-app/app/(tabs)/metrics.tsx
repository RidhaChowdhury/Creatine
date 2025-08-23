import { View, SafeAreaView, ScrollView, ActivityIndicator } from 'react-native';
import React, { useState, useEffect, useContext } from 'react';
import { Text } from '@/components/ui/text';
import { Box } from '@/components/ui/box';
import { CalendarDays, ChartPie, Flame } from 'lucide-react-native';
import { VStack } from '@/components/ui/vstack';
import HeatCalendar from '@/components/HeatCalendar';
import { supabase } from '@/lib/supabase';
import { Pie, PolarChart } from 'victory-native';
import { Divider } from '@/components/ui/divider';
import CombinedHistory from '@/components/CombinedHistory';
import { Button, ButtonText } from '@/components/ui/button';
import { GlassWater } from 'lucide-react-native';
import CreatineScoopIcon from '@/components/CreatineScoop';
import { HistoryChart } from '@/components/IntakeLineChart';
import { calculateSaturation } from '@/utils/creatineSaturationModel';
import { calculateHydrationSaturation, UserProfile } from '@/utils/hydrationSaturationModel';
import { getAllMetrics } from '@/utils/consumptionMetrics';

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
   const hydrationTickValues = [0, 25, 50, 75, 100];
   const hydrationLineColor = '#3B82F6';

   const saturationTickValues = [0, 25, 50, 75, 100];
   const saturationLineColor = '#805AD5';
   const waterLineColor = '#4299E1';
   const creatineLineColor = '#48BB78';

   const tickCount = 5;
   const waterStep = 25;
   const creatineStep = 2;
   const waterTickValues = Array.from({ length: tickCount }, (_, i) => waterStep * i);
   const creatineTickValues = Array.from({ length: tickCount }, (_, i) => creatineStep * i);

   const rangeOptions = [7, 30, 90];

   // ---- Aggregate Metrics ----
   const metrics = getAllMetrics({
      creatineLogs: creatineLogs as any, // already shape { consumed_at, amount }
      waterLogs: waterLogs as any,
      waterGoal: settings.water_goal || 0,
      periodDays: 30,
      windowDays: 30
   });

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
                  <Text className='text-[20px] font-semibold pl-[7]'>
                     {/* {openPage === 'creatine' ? 'Creatine' : 'Water'} History */}
                     Water History
                  </Text>
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
                        <View className='bg-primary-0 rounded-[15px] p-3 h-24 justify-between'>
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
            <View className='mb-4'>
               <HistoryChart
                  data={waterChartData}
                  lineColor={waterLineColor}
                  yAxisTickValues={waterTickValues}
                  yAxisTickCount={tickCount}
                  title={'Water Intake'}
                  rangeOptions={rangeOptions}
                  currentRange={waterRange}
                  onRangeChange={setWaterRange}
                  height={200}
               />
            </View>
            <View className='mb-8'>
               <HistoryChart
                  data={creatineChartData}
                  lineColor={creatineLineColor}
                  yAxisTickValues={creatineTickValues}
                  yAxisTickCount={tickCount}
                  title={'Creatine Intake'}
                  rangeOptions={rangeOptions}
                  currentRange={creatineRange}
                  onRangeChange={setCreatineRange}
                  height={200}
               />
            </View>
            <View className='mb-8'>
               <HistoryChart
                  data={hydrationSeries}
                  lineColor={hydrationLineColor}
                  yAxisTickValues={hydrationTickValues}
                  yAxisTickCount={hydrationTickValues.length}
                  title={'Hydration Saturation'}
                  rangeOptions={rangeOptions}
                  currentRange={hydrationSaturationRange}
                  onRangeChange={setHydrationSaturationRange}
                  height={200}
               />
            </View>
            <View className='mb-8'>
               <HistoryChart
                  data={saturationSeries}
                  lineColor={saturationLineColor}
                  yAxisTickValues={saturationTickValues}
                  yAxisTickCount={saturationTickValues.length}
                  title={'Creatine Saturation'}
                  rangeOptions={rangeOptions}
                  currentRange={creatineSaturationRange}
                  onRangeChange={setCreatineSaturationRange}
                  height={200}
               />
            </View>
         </ScrollView>
      </SafeAreaView>
   );
};

export default Metrics;
