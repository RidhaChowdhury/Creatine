import React from 'react';
import { View } from 'react-native';
import { CartesianChart, Line } from 'victory-native';
import { DashPathEffect } from '@shopify/react-native-skia';
import { useFont } from '@shopify/react-native-skia';
import { Button, Text, XStack, YStack } from 'tamagui';

const spacemono: any = require('@/assets/fonts/SpaceMono-Regular.ttf');

type ChartDataPoint = {
   // default single-series shape
   day?: string;
   amount?: number;
   // multi-series shape (when xKey/yKeys provided)
   x?: string | number;
   [key: string]: any;
};

type Props = {
   data: ChartDataPoint[];
   // Single-series color (used when lines not provided)
   lineColor?: string;
   // Multi-series configuration: supply yKeys and matching lines with colors
   xKey?: string;
   yKeys?: string[];
   lines?: Array<{ key: string; color: string; label?: string }>;
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
   xKey,
   yKeys,
   lines,
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

   const resolvedXKey = xKey ?? 'day';
   const resolvedYKeys = yKeys ?? ['amount'];

   return (
      <View>
         <View style={{ height, position: 'relative' }}>
            <XStack justifyContent="space-between" alignItems="center" marginBottom={9} paddingHorizontal={3} minHeight={44}>
               <Text color="#e9e9e9" fontFamily="$heading" fontSize={24} fontWeight="600">{title}</Text>
               {/* Range buttons overlay (optional) */}
               {Array.isArray(rangeOptions) && onRangeChange ? (
                  <XStack alignItems="center">
                     {rangeOptions.map((opt) => (
                        <Button key={opt} onPress={() => onRangeChange(opt)} minWidth={44} height={40} borderRadius={0} borderWidth={1} borderColor={currentRange === opt ? '#398eff' : '#353535'} backgroundColor={currentRange === opt ? '#101b29' : 'transparent'} marginLeft={-1}>
                           <Text color={currentRange === opt ? '#e9e9e9' : '#999'} fontFamily="$mono" fontSize={10}>{opt}D</Text>
                        </Button>
                     ))}
                  </XStack>
               ) : null}
            </XStack>
            <CartesianChart
               data={data}
               xKey={resolvedXKey}
               yKeys={resolvedYKeys}
               padding={{ top: 15, bottom: 0, left: 0, right: 15 }}
               domainPadding={{ left: 10, right: 10 }}
               xAxis={{
                  font: font,
                  tickCount: computedTickCount,
                  lineColor: '#555',
                  lineWidth: 0.25,
                  labelColor: '#999',
                  axisSide: 'bottom',
                  formatXLabel: (x) => (typeof x === 'string' ? x.slice(-2) : `${x}`)
               }}
               yAxis={[
                  {
                     font: font,
                     tickCount: computedYTickCount,
                     tickValues: computedYTickValues,
                     lineColor: '#555',
                     lineWidth: 1,
                     labelColor: '#999',
                     labelOffset: 10,
                     labelPosition: 'outset',
                     axisSide: 'left',
                     linePathEffect: DashPathEffect({ intervals: [4, 6] })
                  }
               ]}>
               {({ points }) => {
                  // Render multiple or single line depending on props
                  if (Array.isArray(lines) && lines.length > 0) {
                     return (
                        <>
                           {lines.map((l) => (
                              <Line
                                 key={l.key}
                                 points={points[l.key]}
                                 color={l.color}
                                 strokeWidth={3}
                                 animate={{ type: 'timing', duration: 300 }}
                              />
                           ))}
                        </>
                     );
                  }
                  // fallback single-series
                  return (
                     <Line
                        points={(points as any).amount}
                        color={lineColor || '#22d3ee'}
                        strokeWidth={3}
                        animate={{ type: 'timing', duration: 300 }}
                     />
                  );
               }}
            </CartesianChart>
         </View>
         {Array.isArray(lines) && lines.length > 0 ? (
            <XStack marginTop={9} flexWrap="wrap" justifyContent="center" gap={14}>
               {lines.map((l) => (
                  <XStack key={l.key} alignItems="center" gap={6}>
                     <YStack width={8} height={8} borderRadius={4} style={{ backgroundColor: l.color }} />
                     <Text color="#999" fontFamily="$mono" fontSize={10}>{(l.label ?? l.key).toUpperCase()}</Text>
                  </XStack>
               ))}
            </XStack>
         ) : null}
      </View>
   );
};
