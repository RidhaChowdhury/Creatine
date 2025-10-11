import React from 'react';
import { View, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useSelector } from 'react-redux';
import { Text } from '@/components/ui/text';
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import CreatineScoopIcon from './CreatineScoop';
import { GlassWater } from 'lucide-react-native';
import IntakeDrawer from './IntakeDrawer';
type LogInitial = {
   id?: string;
   amount?: number;
   unit?: string;
   consumable?: string;
   consumed_at?: string;
};
// intake actions handled inside IntakeDrawer
import { selectDrinkLogs, selectCreatineLogs } from '@/features/intake/intakeSlice';
import {
   selectWaterGoal,
   selectCreatineGoal,
   selectDrinkUnit,
   selectSupplementUnit
} from '@/features/settings/settingsSlice';
import CombinedHeatCalendar, { CombinedDayData } from './CombinedHeatCalendar';
import { CirclePlus } from 'lucide-react-native';

interface IntakeLog {
   id: string;
   amount: number;
   unit: string;
   consumable: string;
   consumed_at: string;
}

// Use local date parts (not toISOString) so late-night local times don't roll to next UTC day
const formatDate = (d: Date) => {
   const yyyy = d.getFullYear();
   const mm = String(d.getMonth() + 1).padStart(2, '0');
   const dd = String(d.getDate()).padStart(2, '0');
   return `${yyyy}-${mm}-${dd}`;
};

const convertWater = (amount: number, unit: string, targetUnit: string) => {
   if (unit === targetUnit) return amount;
   if (unit === 'oz' && targetUnit === 'ml') return amount * 29.5735;
   if (unit === 'ml' && targetUnit === 'oz') return amount / 29.5735;
   return amount; // fallback
};
const convertCreatine = (amount: number, unit: string, targetUnit: string) => {
   if (unit === targetUnit) return amount;
   if (unit === 'g' && targetUnit === 'mg') return amount * 1000;
   if (unit === 'mg' && targetUnit === 'g') return amount / 1000;
   return amount;
};

export const CombinedHistory: React.FC<{ days?: number }> = ({ days = 28 }) => {
   const drinkLogs = useSelector(selectDrinkLogs) as IntakeLog[];
   const creatineLogs = useSelector(selectCreatineLogs) as IntakeLog[];
   const waterGoal = useSelector(selectWaterGoal) || 0;
   const creatineGoal = useSelector(selectCreatineGoal) || 0;
   const drinkUnit = useSelector(selectDrinkUnit);
   const supplementUnit = useSelector(selectSupplementUnit);

   const [selectedDay, setSelectedDay] = React.useState(formatDate(new Date()));
   const [loading] = React.useState(false);
   // dispatch not required here; IntakeDrawer handles actions

   const [sheetOpen, setSheetOpen] = React.useState(false);
   // unified water-centric drawer
   const [sheetInitial, setSheetInitial] = React.useState<LogInitial | undefined>(undefined);

   const calendarData: CombinedDayData[] = React.useMemo(() => {
      const end = new Date();
      end.setHours(0, 0, 0, 0);
      const map: Record<string, { water: number; creatine: number }> = {};

      for (let i = 0; i < days; i++) {
         const dt = new Date(end);
         dt.setDate(end.getDate() - (days - 1) + i);
         map[formatDate(dt)] = { water: 0, creatine: 0 };
      }

      drinkLogs.forEach((log) => {
         const date = log.consumed_at.slice(0, 10);
         if (!map[date]) return;
         if (log.consumable === 'water') {
            map[date].water += convertWater(log.amount, log.unit, drinkUnit);
         }
      });
      creatineLogs.forEach((log) => {
         const date = log.consumed_at.slice(0, 10);
         if (!map[date]) return;
         map[date].creatine += convertCreatine(log.amount, log.unit, supplementUnit);
      });

      return Object.entries(map).map(([date, { water, creatine }]) => {
         const waterPct = waterGoal > 0 ? Math.min(1, water / waterGoal) : 0;
         const creatineMet = creatineGoal > 0 ? creatine >= creatineGoal : false;
         return {
            date,
            waterPct,
            creatineMet,
            waterAmount: +water.toFixed(2),
            creatineAmount: +creatine.toFixed(2)
         } as CombinedDayData;
      });
   }, [drinkLogs, creatineLogs, days, waterGoal, creatineGoal, drinkUnit, supplementUnit]);

   const dayCreatineLogs = React.useMemo(
      () =>
         creatineLogs
            .filter((l) => l.consumed_at.startsWith(selectedDay))
            .sort((a, b) => (a.consumed_at < b.consumed_at ? -1 : 1)),
      [creatineLogs, selectedDay]
   );
   const dayWaterLogs = React.useMemo(
      () =>
         drinkLogs
            .filter((l) => l.consumed_at.startsWith(selectedDay) && l.consumable === 'water')
            .sort((a, b) => (a.consumed_at < b.consumed_at ? -1 : 1)),
      [drinkLogs, selectedDay]
   );

   // Consolidate logs that share the exact same timestamp into a single chip
   const dayCombinedLogs = React.useMemo(() => {
      const map = new Map<string, { time: string; water?: IntakeLog; creatine?: IntakeLog }>();
      dayWaterLogs.forEach((w) => {
         const t = w.consumed_at;
         const entry = map.get(t) || { time: t };
         entry.water = w;
         map.set(t, entry);
      });
      dayCreatineLogs.forEach((c) => {
         const t = c.consumed_at;
         const entry = map.get(t) || { time: t };
         entry.creatine = c;
         map.set(t, entry);
      });
      return Array.from(map.values()).sort((a, b) => (a.time < b.time ? -1 : 1));
   }, [dayWaterLogs, dayCreatineLogs]);

   const selectedDayData = calendarData.find((d) => d.date === selectedDay);

   const displaySelectedDay = React.useMemo(() => {
      try {
         const [y, m, d] = selectedDay.split('-').map((n) => Number(n));
         // Construct a local Date at midnight to avoid UTC shifting the day
         const localDate = new Date(y || 1970, (m || 1) - 1, d || 1);
         return localDate.toLocaleDateString(undefined, {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
         });
      } catch (e) {
         return selectedDay;
      }
   }, [selectedDay]);

   const openNew = () => {
      try {
         // Pre-populate with selected day at 12:00 local time
         const [y, m, d] = selectedDay.split('-').map((n) => Number(n));
         const noon = new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
         setSheetInitial({ consumed_at: noon.toISOString() });
      } catch {
         // Fallback to now
         setSheetInitial({ consumed_at: new Date().toISOString() });
      }
      setSheetOpen(true);
   };

   const openEdit = (log: IntakeLog) => {
      setSheetInitial({
         id: log.id,
         amount: log.amount,
         unit: log.unit,
         consumable: log.consumable,
         consumed_at: log.consumed_at
      });
      setSheetOpen(true);
   };

   const openEditCombined = (item: { time: string; water?: IntakeLog; creatine?: IntakeLog }) => {
      if (item.water) {
         setSheetInitial({
            id: item.water.id,
            amount: item.water.amount,
            unit: item.water.unit,
            consumable: item.creatine ? 'water+creatine' : item.water.consumable,
            consumed_at: item.time
         });
      } else if (item.creatine) {
         setSheetInitial({
            id: item.creatine.id,
            amount: item.creatine.amount,
            unit: item.creatine.unit,
            consumable: item.creatine.consumable,
            consumed_at: item.time
         });
      }
      setSheetOpen(true);
   };

   // Handlers now live inside IntakeDrawer

   return (
      <View>
         {loading ? (
            <View className='py-8'>
               <ActivityIndicator
                  size='large'
                  color='#ffffff'
               />
            </View>
         ) : (
            <VStack>
               <Box className='mt-4 bg-primary-0 rounded-[15px]'>
                  <CombinedHeatCalendar
                     data={calendarData}
                     endDate={formatDate(new Date())}
                     numDays={days}
                     selectedDate={selectedDay}
                     onDayPress={(d) => setSelectedDay(d)}
                  />

                  <View className='px-4 pb-4'>
                     <View className='flex flex-row justify-between items-center'>
                        <Text className='text-lg font-bold'>{displaySelectedDay}</Text>
                        <Text className='text-sm'>
                           {selectedDayData?.waterAmount ?? 0} / {waterGoal} {drinkUnit}
                        </Text>
                        <Text className='text-sm'>
                           {selectedDayData?.creatineAmount ?? 0} / {creatineGoal} {supplementUnit}
                        </Text>
                        <TouchableOpacity onPress={() => openNew()}>
                           <CirclePlus
                              color='#ffffff'
                              size={18}
                           />
                        </TouchableOpacity>
                     </View>
                     {dayCombinedLogs.length === 0 && (
                        <Text className='text-sm mb-2'>No logs for this day...</Text>
                     )}
                     {dayCombinedLogs.map((item) => (
                        <TouchableOpacity
                           key={`${item.time}-${item.water?.id || 'w'}-${item.creatine?.id || 'c'}`}
                           onPress={() => openEditCombined(item)}>
                           <Box className='p-3 rounded-lg bg-background-100 mb-2'>
                              <View className='flex-row justify-between'>
                                 <Text>
                                    {item.water && (
                                       <>
                                          {convertWater(
                                             item.water.amount,
                                             item.water.unit,
                                             drinkUnit
                                          ).toFixed(0)}{' '}
                                          {drinkUnit}
                                       </>
                                    )}
                                    {item.water && item.creatine ? ' | ' : ''}
                                    {item.creatine && (
                                       <>
                                          {convertCreatine(
                                             item.creatine.amount,
                                             item.creatine.unit,
                                             supplementUnit
                                          ).toFixed(0)}{' '}
                                          {supplementUnit}
                                       </>
                                    )}
                                 </Text>
                                 <Text>
                                    {new Date(item.time).toLocaleTimeString([], {
                                       hour: '2-digit',
                                       minute: '2-digit'
                                    })}
                                 </Text>
                              </View>
                           </Box>
                        </TouchableOpacity>
                     ))}
                  </View>
               </Box>

               <IntakeDrawer
                  isOpen={sheetOpen}
                  initial={sheetInitial}
                  onClose={() => setSheetOpen(false)}
               />
            </VStack>
         )}
      </View>
   );
};

export default CombinedHistory;
