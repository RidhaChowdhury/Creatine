import React from 'react';
import { View } from 'react-native';
import { CartesianChart, Bar } from 'victory-native';
import { DashPathEffect } from '@shopify/react-native-skia';
import { useFont } from '@shopify/react-native-skia';
import { Text, XStack, YStack } from 'tamagui';

const spacemono: any = require('@/assets/fonts/SpaceMono-Regular.ttf');

type BucketDatum = { label: string; today: number; avg: number };

type Props = {
   title: string;
   data: BucketDatum[]; // grouped buckets: today vs avg
   todayColor?: string;
   avgColor?: string;
   height?: number;
   yAxisTickCount?: number;
};

export const SimpleBarChart: React.FC<Props> = ({
   title,
   data,
   todayColor = '#22C55E',
   avgColor = '#A78BFA',
   height = 220,
   yAxisTickCount = 5
}) => {
   const font = useFont(spacemono, 12);
   // Convert to CartesianChart format with numeric x to improve bar layout
   const chartData = React.useMemo(
      () => data.map((d, i) => ({ x: i + 1, today: d.today, avg: d.avg, label: d.label })),
      [data]
   );

   // Match axis behavior from HistoryChart
   const computedTickCount = React.useMemo(() => {
      const defaultTicks = 7;
      return Math.min(chartData.length, defaultTicks);
   }, [chartData.length]);

   const { computedYTickValues, computedYTickCount } = React.useMemo(() => {
      const n = Math.max(2, yAxisTickCount ?? 5);
      const maxVal = Math.max(1, ...chartData.map((d: any) => Math.max(d.today || 0, d.avg || 0)));
      // Round step to a nice integer
      const rawStep = maxVal / (n - 1);
      const pow10 = Math.pow(10, Math.floor(Math.log10(rawStep)));
      const niceStep = Math.ceil(rawStep / pow10) * pow10;
      const ticks = Array.from({ length: n }, (_, i) => Math.round(niceStep * i));
      return { computedYTickValues: ticks, computedYTickCount: ticks.length };
   }, [chartData, yAxisTickCount]);

   return (
      <View style={{ height }}>
         <XStack justifyContent="space-between" alignItems="center" marginBottom={9} paddingHorizontal={3} minHeight={44}>
            <Text color="#e9e9e9" fontFamily="$heading" fontSize={24} fontWeight="600">{title}</Text>
         </XStack>
         <CartesianChart
            data={chartData}
            xKey='x'
            yKeys={['today', 'avg']}
            padding={{ top: 15, bottom: 0, left: 0, right: 15 }}
            domainPadding={{ left: 40, right: 40, top: 10 }}
            xAxis={{
               font: font,
               tickCount: computedTickCount,
               lineColor: '#555',
               lineWidth: 0.25,
               labelColor: '#999',
               axisSide: 'bottom',
               formatXLabel: (x) => {
                  if (typeof x === 'number') {
                     const idx = x - 1;
                     return data[idx]?.label ?? '';
                  }
                  return '';
               }
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
            {({ points, chartBounds }) => (
               <>
                  <Bar
                     points={points.today}
                     chartBounds={chartBounds}
                     color={todayColor}
                     barCount={data.length * 2}
                     roundedCorners={{ topLeft: 6, topRight: 6 }}
                  />
                  <Bar
                     points={points.avg}
                     chartBounds={chartBounds}
                     color={avgColor}
                     barCount={data.length * 2}
                     roundedCorners={{ topLeft: 6, topRight: 6 }}
                  />
               </>
            )}
         </CartesianChart>
         {/* Legend */}
         <XStack marginTop={9} alignItems="center" justifyContent="center" gap={18}>
            <XStack alignItems="center" gap={6}><YStack width={8} height={8} style={{ backgroundColor: todayColor }} /><Text color="#999" fontFamily="$mono" fontSize={10}>TODAY</Text></XStack>
            <XStack alignItems="center" gap={6}><YStack width={8} height={8} style={{ backgroundColor: avgColor }} /><Text color="#999" fontFamily="$mono" fontSize={10}>30D AVG</Text></XStack>
         </XStack>
      </View>
   );
};

export default SimpleBarChart;
