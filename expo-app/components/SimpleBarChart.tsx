import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CartesianChart, Bar } from 'victory-native';
import { useFont } from '@shopify/react-native-skia';

const spacemono: any = require('@/assets/fonts/SpaceMono-Regular.ttf');

type BarDatum = { label: string; value: number };

type Props = {
   title: string;
   data: BarDatum[]; // label/value pairs
   color?: string;
   height?: number;
   yAxisTickCount?: number;
};

export const SimpleBarChart: React.FC<Props> = ({
   title,
   data,
   color = '#60A5FA',
   height = 220,
   yAxisTickCount = 5
}) => {
   const font = useFont(spacemono, 12);
   // Convert to CartesianChart format with numeric x to improve bar layout
   const chartData = React.useMemo(
      () => data.map((d, i) => ({ x: i + 1, value: d.value, label: d.label })),
      [data]
   );

   return (
      <View style={{ height }}>
         <View className='flex-row justify-between items-end mb-2 pl-[7] pr-[5]'>
            <Text className='text-[20px] text-white font-semibold'>{title}</Text>
         </View>
         <CartesianChart
            data={chartData}
            xKey='x'
            yKeys={['value']}
            padding={{ top: 15, bottom: 0, left: 0, right: 15 }}
            domainPadding={{ left: 40, right: 40, top: 10 }}
            xAxis={{
               font: font,
               tickCount: Math.min(6, data.length),
               lineColor: '#222',
               lineWidth: 0.25,
               labelColor: '#333',
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
                  tickCount: yAxisTickCount,
                  lineColor: '#333',
                  lineWidth: 1,
                  labelColor: '#333'
               }
            ]}>
            {({ points, chartBounds }) => (
               <Bar
                  points={points.value}
                  chartBounds={chartBounds}
                  color={color}
                  barCount={data.length}
                  roundedCorners={{ topLeft: 6, topRight: 6 }}
               />
            )}
         </CartesianChart>
      </View>
   );
};

export default SimpleBarChart;

const styles = StyleSheet.create({});
