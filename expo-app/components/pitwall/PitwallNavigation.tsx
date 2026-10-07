import React, { useState } from 'react';
import { Pressable } from 'react-native';
import { BarChart3, Droplets, History, Pill, Plus } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
export type PitwallTab = 'today' | 'supps' | 'insights' | 'history';
export type PitwallNavigationProps = {
    activeTab: PitwallTab;
    onTabChange: (tab: PitwallTab) => void;
    onAddPress: () => void;
    darkSurface?: boolean;
    reducedMotion?: boolean;
};
export function PitwallNavigation({ activeTab, onTabChange, onAddPress }: {
    activeTab: PitwallTab;
    onTabChange: (tab: PitwallTab) => void;
    onAddPress: () => void;
    darkSurface?: boolean;
    reducedMotion?: boolean;
}) {
    const items = [{ id: 'today', label: 'Home', Icon: Droplets }, { id: 'supps', label: 'Supps', Icon: Pill }, { id: 'add', label: 'Log intake', Icon: Plus }, { id: 'insights', label: 'Insights', Icon: BarChart3 }, { id: 'history', label: 'History', Icon: History }];
    return <XStack width="100%" alignItems="center" justifyContent="space-between" backgroundColor="#0c0c0c" borderTopWidth={1} borderColor="#2b2b2b" paddingTop={8} paddingBottom={6} role="navigation" aria-label="Main navigation">{items.map(({ id, label, Icon }) => <NavigationItem key={id} label={label} Icon={Icon} add={id === 'add'} selected={id === activeTab} onPress={() => id === 'add' ? onAddPress() : onTabChange(id as PitwallTab)} />)}</XStack>;
}
function NavigationItem({ label, Icon, add, selected, onPress }: { label: string; Icon: typeof Plus; add: boolean; selected: boolean; onPress: () => void }) {
    const [hovered, setHovered] = useState(false), [focused, setFocused] = useState(false);
    return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} aria-current={selected ? 'page' : undefined} onPress={onPress} onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={{ flex: 1, minWidth: 44, minHeight: 64, height: 64, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' }}>
      {({ pressed }) => <YStack alignItems="center" gap={4}>
        <YStack width={add ? 54 : 38} height={add ? 54 : 38} opacity={pressed ? 0.72 : 1} borderRadius={50} borderWidth={focused ? 2 : 0} borderColor="#e9e9e9" alignItems="center" justifyContent="center" backgroundColor={add ? '#398eff' : pressed || hovered ? '#242424' : 'transparent'}>
          <Icon size={add ? 28 : 22} color={add ? '#0c0c0c' : selected ? '#398eff' : '#e9e9e9'} />
        </YStack>
        {!add && <Text fontFamily="$mono" fontSize={10} color={selected ? '#398eff' : '#c5c5c5'}>{label}</Text>}
      </YStack>}
    </Pressable>;
}
