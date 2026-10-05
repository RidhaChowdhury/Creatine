import React, { useState } from 'react';
import { Slot, usePathname, useRouter } from 'expo-router';
import { Button, Text, XStack, YStack } from 'tamagui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { randomUUID } from 'expo-crypto';
import { DropsProvider, useDrops } from '@/features/drops/DropsProvider';
import { useFeedback } from '@/components/FeedbackProvider';
import { PitwallNavigation, PitwallTab } from '@/components/pitwall/PitwallNavigation';
import { AddIntakeSheet } from '@/components/drops/AddIntakeSheet';
import type { MutationReceipt } from '@/lib/drops/types';
export default function TabLayout() { return <DropsProvider><TabsShell /></DropsProvider>; }
function TabsShell() {
    const path = usePathname(), router = useRouter(), inset = useSafeAreaInsets(), d = useDrops(), f = useFeedback();
    const [receipt, setReceipt] = useState<MutationReceipt | null>(null), [error, setError] = useState<string | null>(null), [pending, setPending] = useState(false);
    const lock = React.useRef(false);
    const active: PitwallTab = path.includes('supps') ? 'supps' : path.includes('metrics') ? 'insights' : path.includes('history') ? 'history' : 'today';
    async function undo() { if (!receipt || lock.current)
        return; lock.current = true; setPending(true); setError(null); try {
        await d.undo(receipt, randomUUID());
        setReceipt(null);
        f.confirm('undo');
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        lock.current = false;
        setPending(false);
    } }
    return <YStack flex={1} minHeight={0} backgroundColor="#0c0c0c"><Slot /><YStack position="absolute" bottom={inset.bottom + 6} left={0} right={0} pointerEvents="box-none"><PitwallNavigation activeTab={active} onAddPress={() => d.openAdd()} onTabChange={tab => router.navigate(tab === 'today' ? '/(tabs)' : tab === 'insights' ? '/(tabs)/metrics' : `/(tabs)/${tab}` as any)}/></YStack>{receipt && <XStack position="absolute" bottom={inset.bottom + 82} left={16} right={16} padding={10} backgroundColor="#171717" alignItems="center" gap={8}><Text color="#e9e9e9" flex={1} fontSize={12} role="status">{error ?? `${receipt.kind === 'delete' ? 'Deleted' : receipt.kind === 'edit' ? 'Updated' : 'Added'} ${receipt.after?.name ?? receipt.before?.name} · ${receipt.after?.amount ?? receipt.before?.amount} ${receipt.after?.unit ?? receipt.before?.unit}`}</Text><Button minHeight={44} disabled={pending} onPress={() => void undo()} aria-label="Undo exact intake">Undo</Button><Button minHeight={44} minWidth={44} onPress={() => setReceipt(null)} aria-label="Dismiss receipt">×</Button></XStack>}<AddIntakeSheet onSaved={setReceipt}/></YStack>;
}

