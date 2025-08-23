import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { CartesianChart, Line } from 'victory-native';
import { DashPathEffect } from '@shopify/react-native-skia';
import { useFont } from '@shopify/react-native-skia';
import { Button, ButtonText } from '@/components/ui/button';

const spacemono: any = require('@/assets/fonts/SpaceMono-Regular.ttf');

type ChartDataPoint = {
   day: string;
   amount: number;
};

type Props = {
   data: ChartDataPoint[];
   lineColor: string;
   yAxisTickValues?: number[];
   yAxisTickCount?: number;
   height?: number;
   title: string;
   // optional range controls baked into the chart
   rangeOptions?: number[];
   currentRange?: number;
   onRangeChange?: (d: number) => void;
};

// Chart Component
export const HistoryChart = ({
   data,
   lineColor,
   yAxisTickValues,
   yAxisTickCount = 5,
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

   return (
      <View style={{ height, position: 'relative' }}>
         <View className='flex-row justify-between items-end mb-2 pl-[7] pr-[5]'>
            <Text className='text-[20px] text-white font-semibold'>{title}</Text>
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
            xAxis={{
               font: font,
               tickCount: computedTickCount,
               lineColor: '#222',
               lineWidth: 0.25,
               labelColor: '#333',
               axisSide: 'bottom',
               formatXLabel: (x) => (typeof x === 'string' ? x.slice(-2) : '')
            }}
            yAxis={[
               {
                  font: font,
                  tickCount: yAxisTickCount,
                  tickValues: yAxisTickValues,
                  lineColor: '#333',
                  lineWidth: 1,
                  labelColor: '#333',
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
   );
};

const styles = StyleSheet.create({
   rangeContainer: {
      flexDirection: 'row',
      alignItems: 'center'
   }
});
