import React, { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { Button, Text, XStack, YStack } from 'tamagui';

export type ChartPoint = { label: string; value: number | null; detail: string };
export function DataChart({ points, unit, nowIndex }: { points: ChartPoint[]; unit: string; nowIndex?: number }) {
  const [selected, setSelected] = useState(Math.max(0, (nowIndex ?? points.length) - (nowIndex === undefined ? 1 : 0)));
  const [width, setWidth] = useState(320);
  const [table, setTable] = useState(false);
  const current = Math.min(selected, points.length - 1), point = points[current];
  const max = Math.max(1, ...points.map(p => p.value ?? 0)), height = 140;
  const x = (i: number) => 8 + i / Math.max(1, points.length - 1) * (width - 16);
  const y = (value: number) => height - 12 - value / max * (height - 24);
  const buildPath = (from: number, through: number) => {
    let path = '', connected = false;
    points.forEach((p, i) => { if (i < from || i > through) return; if (p.value === null) { connected = false; return; } path += `${connected ? 'L' : 'M'}${x(i)},${y(p.value)} `; connected = true; });
    return path;
  };
  const scrub = (locationX: number) => setSelected(Math.max(0, Math.min(points.length - 1, Math.round((locationX - 8) / (width - 16) * (points.length - 1)))));
  return <YStack gap={8}>
    <Text color="#888" fontFamily="$mono" fontSize={11}>{Number(max.toFixed(1))} {unit}</Text>
    <View onLayout={e => setWidth(e.nativeEvent.layout.width)} onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true} onResponderGrant={e => scrub(e.nativeEvent.locationX)} onResponderMove={e => scrub(e.nativeEvent.locationX)}>
      <Svg width="100%" height={height} accessible={false}>
        <Line x1={8} x2={width - 8} y1={height - 12} y2={height - 12} stroke="#444" />
        <Path d={buildPath(0, nowIndex ?? points.length - 1)} stroke="#398eff" strokeWidth={2} fill="none" />
        {nowIndex !== undefined && <Path d={buildPath(nowIndex, points.length - 1)} stroke="#398eff" strokeWidth={2} strokeDasharray="5,4" fill="none" />}
        {nowIndex !== undefined && <Line x1={x(nowIndex)} x2={x(nowIndex)} y1={0} y2={height} stroke="#aaa" strokeDasharray="3,4" />}
        <Line x1={x(current)} x2={x(current)} y1={0} y2={height} stroke="#777" />
        {point?.value !== null && point?.value !== undefined && <Circle cx={x(current)} cy={y(point.value)} r={4} fill="#e9e9e9" />}
      </Svg>
    </View>
    <XStack justifyContent="space-between"><Text color="#888" fontSize={11}>{points[0]?.label}</Text>{nowIndex !== undefined && <Text color="#aaa" fontSize={11}>NOW</Text>}<Text color="#888" fontSize={11}>{points[points.length - 1]?.label}</Text></XStack>
    <Text color="#e9e9e9" accessibilityLiveRegion="polite">{point?.label} · {point?.value === null ? 'Unlogged / unavailable' : `${Number((point?.value ?? 0).toFixed(2))} ${unit}`} · {point?.detail}</Text>
    <XStack gap={8} flexWrap="wrap">
      <Button minHeight={44} disabled={current <= 0} onPress={() => setSelected(current - 1)} accessibilityLabel="Previous chart point">Previous</Button>
      <Button minHeight={44} disabled={current >= points.length - 1} onPress={() => setSelected(current + 1)} accessibilityLabel="Next chart point">Next</Button>
      <Button minHeight={44} onPress={() => setTable(!table)}>{table ? 'Hide data' : 'View data'}</Button>
    </XStack>
    {table && points.map((p, i) => <Text key={i} color="#aaa" fontSize={12}>{p.label} · {p.value === null ? 'Unknown' : `${Number(p.value.toFixed(2))} ${unit}`} · {p.detail}</Text>)}
  </YStack>;
}
