import React from 'react';
import { Button, Text, XStack, YStack, Input, ScrollView } from 'tamagui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDrops } from '@/features/drops/DropsProvider';
export const ink = '#e9e9e9';
export function Screen({ title, children, action }: {
    title: string;
    children: React.ReactNode;
    action?: React.ReactNode;
}) {
    const inset = useSafeAreaInsets();
    return <ScrollView flex={1} backgroundColor="#0c0c0c" contentContainerStyle={{ paddingTop: inset.top + 26, paddingBottom: inset.bottom + 110, paddingHorizontal: 24 }}><YStack gap={22} width="100%" maxWidth={900} alignSelf="center"><Text fontFamily="$brand" fontWeight="800" fontSize={26} color={ink}>DROPS.</Text><XStack alignItems="center" justifyContent="space-between"><Text role="heading" fontFamily="$display" fontWeight="600" fontSize={42} color={ink}>{title}</Text>{action}</XStack>{children}</YStack></ScrollView>;
}
export function StateGate({ children }: {
    children: React.ReactNode;
}) { const { snapshot, status, error, refresh } = useDrops(); if (status === 'error')
    return <Screen title="Unable to load"><Text color={ink} role="alert">{error}</Text><Action label="Try again" onPress={() => void refresh()}/></Screen>; if (!snapshot)
    return <Screen title="Loading"><Text color="#aaa" role="status">Loading your saved records…</Text></Screen>; return <>{children}</>; }
export function Action({ label, onPress, disabled = false, selected = false }: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    selected?: boolean;
}) { return <Button minWidth={44} minHeight={44} borderRadius={0} backgroundColor={selected ? '#398eff' : 'transparent'} borderWidth={1} borderColor={selected ? '#398eff' : '#444'} color={ink} paddingHorizontal={12} disabled={disabled} onPress={onPress} aria-label={label}>{label}</Button>; }
export function Field({ label, value, onChange, placeholder }: {
    label: string;
    value: string;
    onChange: (s: string) => void;
    placeholder?: string;
}) { return <YStack gap={7}><Text fontFamily="$mono" fontSize={11} color="#aaa">{label}</Text><Input aria-label={label} value={value} onChangeText={onChange} placeholder={placeholder} minHeight={44} borderRadius={0} borderColor="#444" backgroundColor="#0c0c0c" color={ink}/></YStack>; }
export function Choices({ label, values, value, onChange }: {
    label: string;
    values: string[];
    value: string;
    onChange: (s: string) => void;
}) { return <YStack gap={7}><Text fontFamily="$mono" fontSize={11} color="#aaa">{label}</Text><XStack gap={8} flexWrap="wrap">{values.map(v => <Action key={v} label={v} selected={v === value} onPress={() => onChange(v)}/>)}</XStack></YStack>; }
export function Failure({ message }: {
    message: string | null;
}) { return message ? <Text color="#ffb3aa" role="alert">{message}</Text> : null; }

