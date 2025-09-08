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

const formatDate = (d: Date) => d.toISOString().split('T')[0];

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
                        <TouchableOpacity onPress={() => openNew()}>
                           <CirclePlus
                              color='#ffffff'
                              size={18}
                           />
                        </TouchableOpacity>
                     </View>
                     <View className='flex-row items-center justify-between gap-2 mb-2'>
                        <Text className='text-md font-semibold'>Creatine for the day</Text>
                        <Text className='text-sm'>
                           {selectedDayData?.creatineAmount ?? 0} / {creatineGoal} {supplementUnit}
                        </Text>
                     </View>
                     {dayCreatineLogs.length === 0 && (
                        <Text className='text-sm mb-2'>No creatine logs for this day...</Text>
                     )}
                     {dayCreatineLogs.map((log) => (
                        <TouchableOpacity
                           key={log.id}
                           onPress={() => openEdit(log)}>
                           <Box className='p-3 rounded-lg mb-2 bg-background-100'>
                              <View className='flex-row justify-between'>
                                 <Text>
                                    {convertCreatine(log.amount, log.unit, supplementUnit)}{' '}
                                    {supplementUnit}
                                 </Text>
                                 <Text>
                                    {new Date(log.consumed_at).toLocaleTimeString([], {
                                       hour: '2-digit',
                                       minute: '2-digit'
                                    })}
                                 </Text>
                              </View>
                           </Box>
                        </TouchableOpacity>
                     ))}

                     <View className='flex-row items-center justify-between gap-2 mt-4 mb-2'>
                        <Text className='text-md font-semibold'>Water for the day</Text>
                        <Text className='text-sm'>
                           {selectedDayData?.waterAmount ?? 0} / {waterGoal} {drinkUnit}
                        </Text>
                     </View>
                     {dayWaterLogs.length === 0 && (
                        <Text className='text-sm mb-2'>No water logs for this day...</Text>
                     )}
                     {dayWaterLogs.map((log) => (
                        <TouchableOpacity
                           key={log.id}
                           onPress={() => openEdit(log)}>
                           <Box className='p-3 rounded-lg bg-background-100 mb-2'>
                              <View className='flex-row justify-between'>
                                 <Text>
                                    {convertWater(log.amount, log.unit, drinkUnit)} {drinkUnit}
                                 </Text>
                                 <Text>
                                    {new Date(log.consumed_at).toLocaleTimeString([], {
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
