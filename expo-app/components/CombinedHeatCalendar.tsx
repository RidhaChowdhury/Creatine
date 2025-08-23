import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
const CELL_SIZE = (width - 80) / 7.5;

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
   data,
   endDate,
   numDays,
   selectedDate,
   onDayPress,
   waterFillColor = '#3399ff',
   emptyColor = '#1f2937'
}) => {
   const map = React.useMemo(
      () =>
         data.reduce(
            (acc, d) => {
               acc[d.date] = d;
               return acc;
            },
            {} as Record<string, CombinedDayData>
         ),
      [data]
   );

   const end = parseDateString(endDate);
   const start = new Date(end);
   start.setUTCDate(start.getUTCDate() - numDays + 1);

   const allDates = Array.from({ length: numDays }, (_, i) => {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + i);
      return date.toISOString().split('T')[0];
   });

   const weeks: string[][] = [];
   for (let i = 0; i < numDays; i += 7) weeks.push(allDates.slice(i, i + 7));

   return (
      <View style={styles.container}>
         {weeks.map((week, w) => (
            <View
               key={w}
               style={styles.weekRow}>
               {week.map((date) => {
                  const datum = map[date];
                  const pct = datum ? Math.min(1, Math.max(0, datum.waterPct)) : 0;
                  const showDot = !!datum?.creatineMet;
                  const dateObj = parseDateString(date);
                  const isFuture = date > endDate;
                  const isSelected = selectedDate === date;
                  return (
                     <TouchableOpacity
                        key={date}
                        disabled={isFuture}
                        onPress={() => !isFuture && onDayPress?.(date)}
                        style={[
                           styles.cellWrapper,
                           { opacity: isFuture ? 0.45 : 1 },
                           isSelected && selectedStyles.selectedWrapper
                        ]}>
                        <View
                           style={[
                              styles.cell,
                              { backgroundColor: emptyColor },
                              isSelected && selectedStyles.selectedCell
                           ]}>
                           <View
                              style={[
                                 styles.fill,
                                 {
                                    height: `${pct * 100}%`,
                                    backgroundColor: waterFillColor,
                                    borderTopLeftRadius: 2,
                                    borderTopRightRadius: 2
                                 }
                              ]}
                           />
                           {showDot && <View style={styles.dot} />}
                           <Text style={styles.dayNumber}>{dateObj.getUTCDate()}</Text>
                        </View>
                     </TouchableOpacity>
                  );
               })}
            </View>
         ))}
      </View>
   );
};

const styles = StyleSheet.create({
   container: {
      gap: 8,
      padding: 16
   },
   weekRow: {
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'center'
   },
   cellWrapper: {
      width: CELL_SIZE,
      height: CELL_SIZE
   },
   cell: {
      flex: 1,
      borderRadius: 6,
      overflow: 'hidden',
      justifyContent: 'flex-end'
   },
   fill: {
      width: '100%',
      position: 'absolute',
      bottom: 0,
      left: 0
   },
   dot: {
      position: 'absolute',
      top: '40%',
      left: '50%',
      width: 8,
      height: 8,
      marginLeft: -4,
      borderRadius: 4,
      backgroundColor: '#ffffff',
      opacity: 0.75
   },
   dayNumber: {
      position: 'absolute',
      top: 2,
      right: 3,
      fontSize: 9,
      color: '#cbd5e1'
   }
});

// highlight styles for selected date
const SELECTED_BORDER_COLOR = '#f59e0b';

const selectedStyles = StyleSheet.create({
   selectedWrapper: {
      borderWidth: 2,
      borderColor: SELECTED_BORDER_COLOR,
      borderRadius: 8
   },
   selectedCell: {
      borderRadius: 6,
      overflow: 'hidden'
   }
});

// merge selected styles into styles object so usage is consistent
Object.assign(styles, selectedStyles);

export default CombinedHeatCalendar;
