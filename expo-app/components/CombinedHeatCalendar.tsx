import React from 'react';
import { useWindowDimensions } from 'react-native';
import { Button, Text, XStack, YStack } from 'tamagui';

export type CombinedDayData = {
   date: string;
   waterPct: number;
   creatineMet: boolean;
   waterAmount: number;
   creatineAmount: number;
};

type Props = {
   data: CombinedDayData[];
   endDate: string;
   numDays: number;
   selectedDate?: string;
   onDayPress?: (date: string) => void;
   waterFillColor?: string;
   emptyColor?: string;
};

const parseDateString = (dateStr: string) => {
   const [year, month, day] = dateStr.split('-').map(Number);
   return new Date(Date.UTC(year, month - 1, day));
};

export const CombinedHeatCalendar: React.FC<Props> = ({
   data, endDate, numDays, selectedDate, onDayPress,
   waterFillColor = '#398eff', emptyColor = '#242424'
}) => {
   const { width } = useWindowDimensions();
   const map = React.useMemo(() => Object.fromEntries(data.map((day) => [day.date, day])) as Record<string, CombinedDayData>, [data]);
   const end = parseDateString(endDate);
   const start = new Date(end);
   start.setUTCDate(start.getUTCDate() - numDays + 1);
   const allDates = Array.from({ length: numDays }, (_, index) => {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + index);
      return date.toISOString().slice(0, 10);
   });
   const weeks: string[][] = [];
   for (let index = 0; index < numDays; index += 7) weeks.push(allDates.slice(index, index + 7));
   const cellSize = Math.min(43, Math.max(30, (width - 88) / 7.25));

   return <YStack gap={8} paddingVertical={10} aria-label={`${numDays} day intake calendar`}>
      {weeks.map((week, weekIndex) => <XStack key={weekIndex} justifyContent="space-between" gap={5}>
         {week.map((date) => {
            const datum = map[date];
            const pct = datum ? Math.min(1, Math.max(0, datum.waterPct)) : 0;
            const selected = selectedDate === date;
            const future = date > endDate;
            const dateObj = parseDateString(date);
            return <Button key={date} unstyled disabled={future} onPress={() => onDayPress?.(date)} role="button"
               aria-label={`${date}, ${Math.round(pct * 100)} percent of water goal${datum?.creatineMet ? ', creatine goal met' : ''}`}
               aria-pressed={selected}
               width={`${100 / 7}%`} height={cellSize} maxWidth={cellSize} minWidth={26} borderRadius={2} overflow="hidden"
               borderWidth={selected ? 1 : 0} borderColor={selected ? '#e9e9e9' : 'transparent'} style={{ backgroundColor: emptyColor }} opacity={future ? 0.35 : 1}>
               <YStack position="absolute" bottom={0} left={0} right={0} height={`${pct * 100}%`} style={{ backgroundColor: waterFillColor }} />
               {datum?.creatineMet ? <YStack position="absolute" top="43%" left="43%" width={5} height={5} borderRadius={3} backgroundColor="#e9e9e9" /> : null}
               <Text position="absolute" top={3} right={4} color="#d3d3d3" fontFamily="$mono" fontSize={9}>{dateObj.getUTCDate()}</Text>
            </Button>;
         })}
      </XStack>)}
      <XStack alignItems="center" gap={14} paddingTop={3}>
         <XStack alignItems="center" gap={6}><YStack width={9} height={9} style={{ backgroundColor: waterFillColor }} /><Text color="#999" fontFamily="$mono" fontSize={9}>WATER</Text></XStack>
         <XStack alignItems="center" gap={6}><YStack width={6} height={6} borderRadius={3} backgroundColor="#e9e9e9" /><Text color="#999" fontFamily="$mono" fontSize={9}>CREATINE GOAL</Text></XStack>
      </XStack>
   </YStack>;
};

export default CombinedHeatCalendar;
