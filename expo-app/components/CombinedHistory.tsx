import React from 'react';
import { ActivityIndicator } from 'react-native';
import { useSelector } from 'react-redux';
import { Button, Text, XStack, YStack } from 'tamagui';
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
import { entryDate, localDay } from '@/lib/dateTime';

interface IntakeLog {
   id: string;
   amount: number;
   unit: string;
   consumable: string;
   consumed_at: string;
}
type CombinedLogItem = { time: string; water?: IntakeLog; creatine?: IntakeLog };

// Use local date parts (not toISOString) so late-night local times don't roll to next UTC day
const formatDate = (d: Date) => {
   const yyyy = d.getFullYear();
   const mm = String(d.getMonth() + 1).padStart(2, '0');
   const dd = String(d.getDate()).padStart(2, '0');
   return `${yyyy}-${mm}-${dd}`;
};
const localDateForLog = (value: string) => localDay(value);

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

export const CombinedHistory: React.FC<{ days?: number }> = ({ days = 30 }) => {
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
         const date = localDateForLog(log.consumed_at);
         if (!map[date]) return;
         if (log.consumable === 'water') {
            map[date].water += convertWater(log.amount, log.unit, drinkUnit);
         }
      });
      creatineLogs.forEach((log) => {
         const date = localDateForLog(log.consumed_at);
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
            .filter((l) => localDateForLog(l.consumed_at) === selectedDay)
            .sort((a, b) => (a.consumed_at < b.consumed_at ? -1 : 1)),
      [creatineLogs, selectedDay]
   );
   const dayWaterLogs = React.useMemo(
      () =>
         drinkLogs
            .filter((l) => localDateForLog(l.consumed_at) === selectedDay && l.consumable === 'water')
            .sort((a, b) => (a.consumed_at < b.consumed_at ? -1 : 1)),
      [drinkLogs, selectedDay]
   );

   // Consolidate logs that share the exact same timestamp into a single chip
   const dayCombinedLogs = React.useMemo(() => {
      const map = new Map<string, { time: string; water: IntakeLog[]; creatine: IntakeLog[] }>();
      dayWaterLogs.forEach((w) => {
         const t = w.consumed_at;
         const entry = map.get(t) || { time: t, water: [], creatine: [] };
         entry.water.push(w);
         map.set(t, entry);
      });
      dayCreatineLogs.forEach((c) => {
         const t = c.consumed_at;
         const entry = map.get(t) || { time: t, water: [], creatine: [] };
         entry.creatine.push(c);
         map.set(t, entry);
      });
      // Pair only unambiguous single entries. Duplicate same-second rows stay separate
      // so every edit action continues to target its own stored ID.
      return Array.from(map.values())
         .flatMap((entry) => entry.water.length === 1 && entry.creatine.length === 1
            ? [{ time: entry.time, water: entry.water[0], creatine: entry.creatine[0] } as CombinedLogItem]
            : [
               ...entry.water.map((water): CombinedLogItem => ({ time: entry.time, water })),
               ...entry.creatine.map((creatine): CombinedLogItem => ({ time: entry.time, creatine }))
            ])
         .sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : `${a.water?.id ?? ''}${a.creatine?.id ?? ''}`.localeCompare(`${b.water?.id ?? ''}${b.creatine?.id ?? ''}`)));
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

   const openEditCombined = (item: CombinedLogItem) => {
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
      <YStack>
         {loading ? (
               <YStack paddingVertical={32} alignItems="center"><ActivityIndicator size="large" color="#e9e9e9" /></YStack>
         ) : (
            <YStack>
               <YStack paddingVertical={12} borderBottomWidth={1} borderColor="#353535">
                  <CombinedHeatCalendar
                     data={calendarData}
                     endDate={formatDate(new Date())}
                     numDays={days}
                     selectedDate={selectedDay}
                     onDayPress={(d) => setSelectedDay(d)}
                  />

                  <YStack paddingHorizontal={4} paddingBottom={12}>
                     <XStack alignItems="center" justifyContent="space-between" gap={8} flexWrap="wrap" minHeight={46}>
                        <Text color="#e9e9e9" fontFamily="$heading" fontSize={23} fontWeight="600">{displaySelectedDay}</Text>
                        <XStack gap={12} flexWrap="wrap">
                           <Text color="#aaa" fontFamily="$mono" fontSize={10}>{(selectedDayData?.waterAmount ?? 0).toFixed(0)} / {waterGoal} {drinkUnit}</Text>
                           <Text color="#aaa" fontFamily="$mono" fontSize={10}>{(selectedDayData?.creatineAmount ?? 0).toFixed(1)} / {creatineGoal} {supplementUnit}</Text>
                        </XStack>
                        <Button unstyled onPress={openNew} role="button" aria-label="Add intake for selected day" width={44} height={44} alignItems="center" justifyContent="center">
                           <CirclePlus color="#398eff" size={20} />
                        </Button>
                     </XStack>
                     {dayCombinedLogs.length === 0 && (
                        <Text color="#888" fontFamily="$body" fontSize={13} paddingVertical={9}>No logs for this day.</Text>
                     )}
                     {dayCombinedLogs.map((item) => (
                        <Button unstyled key={`${item.time}-${item.water?.id || 'w'}-${item.creatine?.id || 'c'}`} onPress={() => openEditCombined(item)} role="button" aria-label={`Edit intake at ${entryDate(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`} minHeight={48} borderTopWidth={1} borderColor="#262626" paddingHorizontal={3}>
                              <XStack justifyContent="space-between" alignItems="center" width="100%">
                                 <Text color="#e9e9e9" fontFamily="$mono" fontSize={12}>
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
                                 <Text color="#999" fontFamily="$mono" fontSize={11}>
                                    {entryDate(item.time).toLocaleTimeString([], {
                                       hour: '2-digit',
                                       minute: '2-digit'
                                    })}
                                 </Text>
                              </XStack>
                        </Button>
                     ))}
                  </YStack>
               </YStack>

               <IntakeDrawer
                  isOpen={sheetOpen}
                  initial={sheetInitial}
                  onClose={() => setSheetOpen(false)}
               />
            </YStack>
         )}
      </YStack>
   );
};

export default CombinedHistory;
