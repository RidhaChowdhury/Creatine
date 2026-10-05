import React from 'react';
import { BarChart3, Droplets, History, Pill, Plus } from 'lucide-react-native';
import { Button, Text, XStack, YStack } from 'tamagui';
export type PitwallTab = 'today' | 'supps' | 'insights' | 'history';
export type PitwallNavigationProps = {
    activeTab: PitwallTab;
    onTabChange: (tab: PitwallTab) => void;
    onAddPress: () => void;
    darkSurface?: boolean;
    reducedMotion?: boolean;
};
export function PitwallNavigation({ activeTab, onTabChange, onAddPress, darkSurface = true }: {
    activeTab: PitwallTab;
    onTabChange: (tab: PitwallTab) => void;
    onAddPress: () => void;
    darkSurface?: boolean;
    reducedMotion?: boolean;
}) {
    const base = darkSurface ? '#e9e9e9' : '#0c0c0c';
    const items = [{ id: 'today', label: 'Home', Icon: Droplets }, { id: 'supps', label: 'Supps', Icon: Pill }, { id: 'add', label: 'Log intake', Icon: Plus }, { id: 'insights', label: 'Insights', Icon: BarChart3 }, { id: 'history', label: 'History', Icon: History }];
    return <XStack width="100%" alignItems="center" justifyContent="space-between" role="navigation" aria-label="Main navigation">{items.map(({ id, label, Icon }) => <Button key={id} flex={1} minWidth={0} minHeight={64} height={70} padding={0} borderRadius={0} borderWidth={0} backgroundColor="transparent" aria-label={label} aria-current={activeTab === id ? 'page' : undefined} onPress={() => id === 'add' ? onAddPress() : onTabChange(id as PitwallTab)}><YStack alignItems="center" gap={4}><YStack width={id === 'add' ? 54 : 38} height={id === 'add' ? 54 : 38} borderRadius={50} alignItems="center" justifyContent="center" backgroundColor={id === 'add' || id === activeTab ? '#398eff' : 'transparent'}><Icon size={id === 'add' ? 28 : 20} color={id === 'add' || id === activeTab ? '#0c0c0c' : base}/></YStack>{id !== 'add' && <Text fontFamily="$mono" fontSize={9} color={base}>{label}</Text>}</YStack></Button>)}</XStack>;
}
