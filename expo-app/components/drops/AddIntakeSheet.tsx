import React, { useRef, useState } from 'react';
import { ScrollView, YStack, XStack, Text, Button } from 'tamagui';
import { Plus, Check } from 'lucide-react-native';
import { randomUUID } from 'expo-crypto';
import { useDrops } from '@/features/drops/DropsProvider';
import { useFeedback } from '@/components/FeedbackProvider';
import type { MutationReceipt } from '@/lib/drops/types';
import { PitwallSheet } from '@/components/pitwall/PitwallOverlays';
import { EntryEditor } from './EntryEditor';
import { Action, Failure, ink } from './ui';
export function AddIntakeSheet({ onSaved }: {
    onSaved: (r: MutationReceipt) => void;
}) {
    const d = useDrops(), f = useFeedback();
    const [detail, setDetail] = useState(false), [pending, setPending] = useState<string | null>(null), [error, setError] = useState<string | null>(null), [confirmed, setConfirmed] = useState<string | null>(null);
    const lock = useRef(false), operation = useRef<{
        key: string;
        id: string;
    } | null>(null);
    React.useEffect(() => { if (!confirmed)
        return; const timer = setTimeout(() => setConfirmed(null), 1000); return () => clearTimeout(timer); }, [confirmed]);
    React.useEffect(() => { if (d.addRequest) {
        setDetail(!!d.addRequest.trackerId);
        setError(null);
    } }, [d.addRequest]);
    if (!d.addRequest || !d.snapshot)
        return null;
    const s = d.snapshot;
    const presets = s.preferences.prominentPresetIds.map(id => s.preferences.waterPresets.find(p => p.id === id)).filter(p => !!p).slice(0, 2);
    const trackers = s.trackers.filter(t => !t.archived && t.id !== 'builtin:water').sort((a, b) => Number(b.id === s.primaryTrackerId) - Number(a.id === s.primaryTrackerId));
    async function log(key: string, trackerId: string, amount: number | null, unit: string) { if (lock.current)
        return; if (amount === null) {
        d.openAdd({ trackerId });
        setDetail(true);
        return;
    } lock.current = true; setPending(key); setError(null); f.prime(); const intentKey = JSON.stringify({ trackerId, amount, unit }); if (operation.current?.key !== intentKey)
        operation.current = { key: intentKey, id: randomUUID() }; try {
        const r = await d.add({ trackerId, amount, unit, consumedAt: d.now.toISOString(), note: '' }, operation.current.id);
        onSaved(r);
        setConfirmed(key);
        operation.current = null;
        f.confirm(trackerId === 'builtin:water' ? 'water' : 'supplement');
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        lock.current = false;
        setPending(null);
    } }
    if (detail)
        return <EntryEditor prefill={d.addRequest} onClose={() => { setDetail(false); d.closeAdd(); }} onSaved={onSaved}/>;
    return <PitwallSheet open onOpenChange={open => { if (!open && !pending)
        d.closeAdd(); }} title="Log intake"><ScrollView keyboardShouldPersistTaps="handled"><YStack gap={18} paddingBottom={24}><Text fontFamily="$mono" color="#aaa" fontSize={12}>WATER</Text><XStack gap={12}>{presets.map(p => <Button key={p.id} flex={1} minWidth={0} minHeight={80} borderRadius={0} borderWidth={1} borderColor="#777" backgroundColor="transparent" disabled={!!pending} onPress={() => void log(p.id, 'builtin:water', p.amount, p.unit)} aria-label={`Add ${p.amount} ${p.unit} water`}><Plus color="#398eff" size={18}/><Text fontFamily="$display" fontWeight="600" fontSize={32} color={ink}>{p.amount}</Text><Text fontFamily="$mono" fontSize={13} color={ink}>{p.unit}</Text></Button>)}</XStack>{trackers.map(t => <Button key={t.id} minHeight={74} height="auto" paddingVertical={16} paddingHorizontal={4} borderRadius={t.id === s.primaryTrackerId ? 4 : 0} borderWidth={0} borderBottomWidth={1} borderColor="#333" backgroundColor="transparent" justifyContent="space-between" disabled={!!pending} onPress={() => void log(t.id, t.id, t.savedDose, t.unit)} aria-label={t.savedDose === null ? `Enter ${t.name} intake` : `Log ${t.savedDose} ${t.unit} ${t.name}`}><Text flex={1} minWidth={0} fontFamily="$supplement" fontWeight="600" fontSize={28} color={ink} textTransform="uppercase">{t.name}</Text><XStack alignItems="center" gap={8}>{confirmed === t.id ? <Check size={20} color="#398eff"/> : <Plus size={20} color="#398eff"/>}<Text fontFamily="$display" fontSize={27} color="#398eff">{pending === t.id ? 'Saving…' : t.savedDose === null ? 'Details' : `${t.savedDose} ${t.unit}`}</Text></XStack></Button>)}<Failure message={error}/><Action label="Detailed entry" disabled={!!pending} onPress={() => setDetail(true)}/><Action label="Done" disabled={!!pending} onPress={() => d.closeAdd()}/></YStack></ScrollView></PitwallSheet>;
}
