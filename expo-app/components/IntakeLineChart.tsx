import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { CartesianChart, Line } from 'victory-native';
import { DashPathEffect } from '@shopify/react-native-skia';
import { useFont } from '@shopify/react-native-skia';
import { Button, ButtonText } from '@/components/ui/button';
import { Box } from './ui/box';

const spacemono: any = require('@/assets/fonts/SpaceMono-Regular.ttf');

type ChartDataPoint = {
   day: string;
   amount: number;
};

type Props = {
   data: ChartDataPoint[];
   lineColor: string;
   yMax?: number;
   yTickCount?: number;
   yAxisTickValues?: number[];
   yAxisTickCount?: number;
   height?: number;
   title: string;
   rangeOptions?: number[];
   currentRange?: number;
   onRangeChange?: (d: number) => void;
};

// Chart Component
export const HistoryChart = ({
   data,
   lineColor,
   yMax,
   yTickCount,
   yAxisTickValues,
   yAxisTickCount,
   height = 200,
   title,
   rangeOptions,
   currentRange,
   onRangeChange
}: Props) => {
   const font = useFont(spacemono, 12);

   // Compute x-axis tick count via a lookup table to make ranges/data-driven
   const computedTickCount = React.useMemo(() => {
      const tickMap: Record<number, number> = {
         7: 7,
         30: 6,
         90: 9
      };
      const defaultTicks = 7;
      const desired = currentRange ? (tickMap[currentRange] ?? defaultTicks) : defaultTicks;
      return Math.min(data.length, desired);
   }, [currentRange, data.length]);

   // Auto-compute Y ticks if not explicitly provided
   const computedYTickValues = React.useMemo(() => {
      if (Array.isArray(yAxisTickValues) && yAxisTickValues.length > 0) return yAxisTickValues;
      const count = yTickCount ?? yAxisTickCount ?? 5;
      const max = yMax ?? 100;
      const n = Math.max(2, count);
      const step = max / (n - 1);
      return Array.from({ length: n }, (_, i) => Math.round(step * i));
   }, [yAxisTickValues, yTickCount, yAxisTickCount, yMax]);

   const computedYTickCount = React.useMemo(() => {
      if (Array.isArray(yAxisTickValues) && yAxisTickValues.length > 0)
         return yAxisTickValues.length;
      return yTickCount ?? yAxisTickCount ?? 5;
   }, [yAxisTickValues, yTickCount, yAxisTickCount]);

   return (
      <Box className='bg-primary-0 p-4 rounded-lg'>
         <View style={{ height, position: 'relative' }}>
            <View className='flex-row justify-between items-center mb-2 pl-[7] pr-[5]'>
               <Text className='text-lg text-white font-semibold'>{title}</Text>
               {/* Range buttons overlay (optional) */}
               {Array.isArray(rangeOptions) && onRangeChange ? (
                  <View style={styles.rangeContainer}>
                     {rangeOptions.map((opt) => (
                        <View
                           key={opt}
                           style={{ margin: 0 }}>
                           {(() => {
                              const idx = rangeOptions.indexOf(opt);
                              const isFirst = idx === 0;
                              const isLast = idx === rangeOptions.length - 1;
                              const btnStyle: any = { borderRadius: 0 };

                              if (isFirst) {
                                 btnStyle.borderTopLeftRadius = 8;
                                 btnStyle.borderBottomLeftRadius = 8;
                              } else if (isLast) {
                                 btnStyle.borderTopRightRadius = 8;
                                 btnStyle.borderBottomRightRadius = 8;
                              }

                              return (
                                 <Button
                                    size='sm'
                                    variant={currentRange === opt ? 'solid' : 'outline'}
                                    onPress={() => onRangeChange(opt)}
                                    style={btnStyle}>
                                    <ButtonText
                                       className={`text-xs ${currentRange === opt ? 'text-black' : 'text-typography-500'}`}>
                                       {opt === 7 ? '7D' : opt === 30 ? '1M' : '3M'}
                                    </ButtonText>
                                 </Button>
                              );
                           })()}
                        </View>
                     ))}
                  </View>
               ) : null}
            </View>
            <CartesianChart
               data={data}
               xKey='day'
               yKeys={['amount']}
               padding={{ top: 15, bottom: 0, left: 0, right: 15 }}
               domainPadding={{ left: 10, right: 10 }}
               xAxis={{
                  font: font,
                  tickCount: computedTickCount,
                  lineColor: '#fff',
                  lineWidth: 0.25,
                  labelColor: '#fff',
                  axisSide: 'bottom',
                  formatXLabel: (x) => (typeof x === 'string' ? x.slice(-2) : '')
               }}
               yAxis={[
                  {
                     font: font,
                     tickCount: computedYTickCount,
                     tickValues: computedYTickValues,
                     lineColor: '#fff',
                     lineWidth: 1,
                     labelColor: '#fff',
                     labelOffset: 10,
                     labelPosition: 'outset',
                     axisSide: 'left',
                     linePathEffect: DashPathEffect({ intervals: [4, 6] })
                  }
               ]}>
               {({ points }) => (
                  <Line
                     points={points.amount}
                     color={lineColor}
                     strokeWidth={4}
                     animate={{ type: 'timing', duration: 300 }}
                  />
               )}
            </CartesianChart>
         </View>
      </Box>
   );
};

const styles = StyleSheet.create({
   rangeContainer: {
      flexDirection: 'row',
      alignItems: 'center'
   }
});
