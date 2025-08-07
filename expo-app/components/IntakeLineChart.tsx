import React from 'react';
import { useSelector } from 'react-redux';
import { View } from 'react-native';
import { CartesianChart, Line } from 'victory-native';
import { selectWaterLogs } from '@/features/intake/intakeSlice';
import type { RootState } from '@/store/store';
import { DashPathEffect } from '@shopify/react-native-skia';
import { useFont } from '@shopify/react-native-skia';
import spacemono from '@/assets/fonts/SpaceMono-Regular.ttf';

type Props = {
   metric: 'hydration' | 'creatine';
   days?: number;
};

// Chart Component
export const HistoryChart = ({ metric, days = 7 }: Props) => {
   // Font Setup
   const font = useFont(spacemono, 12);

   // Selectors & Data Preparation
   const chartData = useSelector((state: RootState) => selectWaterLogs(state));
   const waterGoal = useSelector((state: RootState) => state.settings.water_goal);
   const lineColor = metric === 'hydration' ? '#4299E1' : '#48BB78';

   // Prepare Data for Chart
   const today = new Date();
   today.setHours(0, 0, 0, 0);

   // For each of the last 'days', sum all entries for that day
   const victoryData = Array.from({ length: days }, (_, i) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (days - 1) + i);
      const dateStr = date.toISOString().slice(0, 10);
      // Sum all logs for this day
      const totalAmount = chartData
         .filter((d) => d.consumed_at.slice(0, 10) === dateStr)
         .reduce((sum, d) => sum + (d.amount || 0), 0);
      return {
         day: dateStr,
         amount: totalAmount
      };
   });

   // Y Axis Tick Calculation
   const tickCount = 5;
   const step = waterGoal && waterGoal > 0 ? Math.ceil(waterGoal / (tickCount - 1)) : 25;
   const tickValues = Array.from({ length: tickCount }, (_, i) => step * i);

   // Render Chart
   return (
      <View style={{ height: 200 }}>
         <CartesianChart
            data={victoryData}
            xKey='day'
            yKeys={['amount']}
            padding={{ top: 15, bottom: 0, left: 0, right: 15 }}
            xAxis={{
               font: font,
               tickCount: days,
               lineColor: '#222',
               lineWidth: 0.25,
               labelColor: '#333',
               axisSide: 'bottom',
               formatXLabel: (x) => (typeof x === 'string' ? x.slice(-2) : '')
            }}
            yAxis={[
               {
                  font: font,
                  tickCount: tickCount,
                  tickValues: tickValues,
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
