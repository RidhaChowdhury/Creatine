import React, { useState } from 'react';
import { YStack, XStack, Text, Button } from 'tamagui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
export type PitwallWaterSceneLayout = {
    width: number;
    height: number;
    level: number;
    valueText: string;
    unit: string;
    goalText: string;
    fontSize: number;
    numberX: number;
    numberTop: number;
    numberBaseline: number;
    onReady?: () => void;
};
export type PitwallWaterFeedback = {
    amount: number;
    direction?: 'add' | 'undo';
    id?: string | number;
};
export type PitwallTracker = {
    id: string;
    name: string;
    unit: string;
    savedDose: number | null;
    category: string;
};
export type PitwallWaterPreset = {
    amount: number;
    unit: string;
};
export function formatPitwallAmount(v: number) { return String(Math.round(v * 1000) / 1000); }
export type PitwallDashboardProps = {
    waterAmount: number;
    waterGoal: number;
    waterLimit?: number | null;
    waterUnit: string;
    renderWater: (layout: PitwallWaterSceneLayout) => React.ReactNode;
    onSetGoal?: () => void;
};
export function PitwallDashboard({ waterAmount, waterGoal, waterLimit, waterUnit, renderWater, onSetGoal }: {
    waterAmount: number;
    waterGoal: number;
    waterLimit?: number | null;
    waterUnit: string;
    renderWater: (layout: PitwallWaterSceneLayout) => React.ReactNode;
    onSetGoal?: () => void;
}) { const inset = useSafeAreaInsets(), [bounds, setBounds] = useState({ width: 0, height: 0 }); const level = waterGoal > 0 ? Math.max(0, Math.min(1, waterAmount / waterGoal)) : 0; const valueText = formatPitwallAmount(waterAmount), goalText = waterGoal > 0 ? waterLimit ? `/ ${formatPitwallAmount(waterGoal)}–${formatPitwallAmount(waterLimit)} ${waterUnit}` : `/ ${formatPitwallAmount(waterGoal)} ${waterUnit}` : 'Goal not set'; const fontSize = Math.max(56, Math.min(300, bounds.height * .34, (bounds.width - 90) / (Math.max(1, valueText.length) * .48))); const baseline = Math.max(inset.top + 150, bounds.height * .53); const layout = { ...bounds, level, valueText, unit: waterUnit, goalText, fontSize, numberX: 24, numberTop: baseline - fontSize * .88, numberBaseline: baseline }; return <YStack flex={1} minHeight={0} backgroundColor="#0c0c0c" onLayout={e => setBounds(e.nativeEvent.layout)}>{bounds.width > 0 && <YStack position="absolute" inset={0} pointerEvents="none">{renderWater(layout)}</YStack>}<Text opacity={0} position="absolute" top={layout.numberTop} left={24} aria-label={`Water today: ${valueText} ${waterUnit}. ${goalText}.`}>{valueText} {waterUnit}</Text><XStack position="absolute" left={24} right={24} top={Math.max(inset.top + 108, layout.numberTop - 38)} justifyContent="space-between"><Text color={level > .85 ? '#0c0c0c' : '#e9e9e9'} fontFamily="$mono" fontSize={11}>01 WATER</Text><Button unstyled minHeight={44} onPress={onSetGoal} aria-label="Edit water target"><Text color={level > .85 ? '#0c0c0c' : '#aaa'} fontFamily="$mono" fontSize={12}>{goalText}</Text></Button></XStack><YStack position="absolute" right={10} top={inset.top + 120} bottom={180} width={8} justifyContent="space-between" pointerEvents="none">{Array.from({ length: 12 }, (_, i) => <YStack key={i} height={1} width={8} backgroundColor="#99999988"/>)}</YStack></YStack>; }
export default PitwallDashboard;
