import React, { useState } from 'react';
import { ScrollView, YStack, XStack, Text } from 'tamagui';
import { randomUUID } from 'expo-crypto';
import { useDrops } from '@/features/drops/DropsProvider';
import { useFeedback } from '@/components/FeedbackProvider';
import { compatibleUnits, convertAmount } from '@/lib/drops/units';
import { wallTimeToInstant } from '@/lib/drops/dates';
import type { DropsEntry, EntryInput, MutationReceipt } from '@/lib/drops/types';
import { PitwallSheet } from '@/components/pitwall/PitwallOverlays';
import { Action, Choices, Field, Failure, ink } from './ui';
export function wallAt(instant: string, timezone: string) { const p = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(instant)); const v = (key: string) => p.find(x => x.type === key)?.value; return `${v('year')}-${v('month')}-${v('day')}T${v('hour')}:${v('minute')}:${v('second')}`; }
export function EntryEditor({ entry, prefill, onClose, onSaved }: {
    entry?: DropsEntry;
    prefill?: {
        trackerId?: string;
        amount?: number;
        unit?: string;
    };
    onClose: () => void;
    onSaved: (r: MutationReceipt) => void;
}) {
    const drops = useDrops(), feedback = useFeedback();
    const s = drops.snapshot!;
    const [trackerId, setTracker] = useState(entry?.trackerId ?? prefill?.trackerId ?? 'builtin:water');
    const tracker = s.trackers.find(t => t.id === trackerId)!;
    const [amount, setAmount] = useState(String(entry?.amount ?? prefill?.amount ?? ''));
    const [unit, setUnit] = useState(entry?.unit ?? prefill?.unit ?? tracker?.unit ?? 'oz');
    const [wall, setWall] = useState(entry?.legacyLocal ?? wallAt(entry?.consumedAtUtc ?? entry?.consumedAt ?? drops.now.toISOString(), s.preferences.timezone));
    const [note, setNote] = useState(entry?.note ?? '');
    const [pending, setPending] = useState(false), [error, setError] = useState<string | null>(null), [confirmDelete, setConfirmDelete] = useState(false);
    const lock = React.useRef(false);
    const operation = React.useRef({ key: '', id: randomUUID() });
    function opFor(key: string) { if (operation.current.key && operation.current.key !== key)
        operation.current = { key, id: randomUUID() };
    else
        operation.current.key = key; return operation.current.id; }
    function changeUnit(next: string) { try {
        if (amount.trim() && Number.isFinite(Number(amount)))
            setAmount(String(convertAmount(Number(amount), unit, next)));
        setUnit(next);
        setError(null);
    }
    catch (e) {
        setError((e as Error).message);
    } }
    async function save() { if (lock.current)
        return; lock.current = true; setPending(true); setError(null); feedback.prime(); try {
        const n = Number(amount);
        if (!Number.isFinite(n) || n <= 0)
            throw new Error('Enter a positive finite amount.');
        const consumedAt = wallTimeToInstant(wall, s.preferences.timezone);
        if (new Date(consumedAt).getTime() > drops.now.getTime())
            throw new Error('Consumption time cannot be in the future.');
        const input: EntryInput = { trackerId, amount: n, unit, consumedAt, note };
        const r = entry ? await drops.edit(entry, input, opFor(JSON.stringify({ kind: 'edit', input }))) : await drops.add(input, opFor(JSON.stringify({ kind: 'add', input })));
        feedback.confirm(trackerId === 'builtin:water' ? 'water' : 'supplement');
        onSaved(r);
        onClose();
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        lock.current = false;
        setPending(false);
    } }
    async function remove() { if (!entry || lock.current)
        return; lock.current = true; setPending(true); setError(null); try {
        const r = await drops.remove(entry, opFor('delete'));
        onSaved(r);
        onClose();
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        lock.current = false;
        setPending(false);
    } }
    return <PitwallSheet open onOpenChange={open => { if (!open && !pending)
        onClose(); }} title={entry ? 'Edit intake' : 'Detailed entry'} description={`Actual consumption time in ${s.preferences.timezone}.`}><ScrollView keyboardShouldPersistTaps="handled"><YStack gap={18} paddingBottom={24}><YStack gap={7}><Text color="#aaa" fontFamily="$mono" fontSize={11}>Tracker</Text><XStack flexWrap="wrap" gap={8}>{s.trackers.filter(t => !t.archived || t.id === trackerId).map(t => <Action key={t.id} label={t.name} selected={t.id === trackerId} onPress={() => { setTracker(t.id); setUnit(t.unit); }}/>)}</XStack></YStack><Field label="Amount" value={amount} onChange={setAmount}/><Choices label="Unit" values={compatibleUnits(tracker?.unit ?? unit).filter(value=>trackerId!=='builtin:water'||['oz','ml','mL','L','cup','cups'].includes(value)||value===unit)} value={unit} onChange={changeUnit}/><Field label="Consumption date and time" value={wall} onChange={setWall} placeholder="YYYY-MM-DDTHH:mm:ss"/><Text color="#aaa" fontSize={12}>Use an explicit offset during a repeated daylight-saving hour.</Text><Field label="Note (optional)" value={note} onChange={setNote}/><Failure message={error}/><XStack gap={12}><Action label={pending ? 'Saving…' : 'Save intake'} disabled={pending} onPress={() => void save()}/><Action label="Cancel" disabled={pending} onPress={onClose}/></XStack>{entry && <YStack gap={10} borderTopWidth={1} borderColor="#333" paddingTop={18}>{confirmDelete ? <><Text color={ink}>Delete this exact intake? Undo will restore it.</Text><XStack gap={8}><Action label="Confirm delete" disabled={pending} onPress={() => void remove()}/><Action label="Keep entry" disabled={pending} onPress={() => setConfirmDelete(false)}/></XStack></> : <Action label="Delete intake" disabled={pending} onPress={() => setConfirmDelete(true)}/>}</YStack>}</YStack></ScrollView></PitwallSheet>;
}
