import React, { useRef, useState } from 'react';
import { ScrollView, Text, XStack, YStack } from 'tamagui';
import { randomUUID } from 'expo-crypto';
import { useDrops } from '@/features/drops/DropsProvider';
import { planForDay } from '@/lib/drops/domain';
import { dayInZone } from '@/lib/drops/dates';
import { compatibleUnits, convertAmount } from '@/lib/drops/units';
import type { DropsTracker, DosePlan, MetricType } from '@/lib/drops/types';
import { PitwallSheet } from '@/components/pitwall/PitwallOverlays';
import { Action, Field, Choices, Failure, ink } from './ui';
export function ProfileEditor({ tracker, onClose }: {
    tracker?: DropsTracker;
    onClose: () => void;
}) {
    const d = useDrops(), s = d.snapshot!, plan = tracker ? planForDay(tracker, dayInZone(d.now, s.preferences.timezone)) : null;
    const [name, setName] = useState(tracker?.name ?? ''), [category, setCategory] = useState(tracker?.category ?? 'supplement'), [metric, setMetric] = useState<MetricType>(tracker?.metricType ?? 'other');
    const initialUnit = tracker?.unit ?? 'g';
    const [unit, setUnit] = useState(initialUnit), [dose, setDose] = useState(tracker?.savedDose?.toString() ?? ''), [target, setTarget] = useState(plan?.target == null ? '' : String(convertAmount(plan.target, plan.unit, initialUnit))), [limit, setLimit] = useState(plan?.limit == null ? '' : String(convertAmount(plan.limit, plan.unit, initialUnit)));
    const [mode, setMode] = useState(plan?.mode ?? 'as-needed'), [days, setDays] = useState<number[]>(plan?.days ?? [0, 1, 2, 3, 4, 5, 6]), [rows, setRows] = useState<(Omit<DosePlan, 'amount'> & {
        amount: string;
    })[]>(plan?.doses.map(r => ({ ...r, amount: String(r.amount) })) ?? []);
    const [pending, setPending] = useState(false), [error, setError] = useState<string | null>(null);
    const lock = useRef(false);
    function number(v: string, label: string) { if (!v.trim())
        return null; const n = Number(v); if (!Number.isFinite(n) || n <= 0)
        throw new Error(`${label} must be a positive finite number.`); return n; }
    function changeUnit(next: string) { if (unit === next)
        return; try {
        setDose(dose ? String(convertAmount(Number(dose), unit, next)) : '');
        setTarget(target ? String(convertAmount(Number(target), unit, next)) : '');
        setLimit(limit ? String(convertAmount(Number(limit), unit, next)) : '');
        setRows(rows.map(r => ({ ...r, amount: String(convertAmount(Number(r.amount), r.unit, next)), unit: next })));
        setUnit(next);
        setError(null);
    }
    catch (e) {
        setError((e as Error).message);
    } }
    async function save() { if (lock.current)
        return; lock.current = true; setPending(true); setError(null); try {
        if (!name.trim())
            throw new Error('Enter a tracker name.');
        if (!unit.trim())
            throw new Error('Enter a unit.');
        if (mode === 'scheduled' && (!days.length || !rows.length))
            throw new Error('Choose planned days and add at least one dose.');
        for (const r of rows) {
            if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time) || !Number.isFinite(Number(r.amount)) || Number(r.amount) <= 0)
                throw new Error('Each scheduled dose needs a valid 24-hour time and positive amount.');
        }
        await d.saveProfile({ id: tracker?.id, name: name.trim(), category, metricType: metric, unit: unit.trim(), savedDose: number(dose, 'Saved dose'), archived: tracker?.archived ?? false, gramsPerUnit: tracker?.gramsPerUnit, plan: { mode, days: mode === 'scheduled' ? days : [], doses: mode === 'scheduled' ? rows.map(r => ({ ...r, amount: Number(r.amount) })) : [], target: number(target, 'Target'), limit: number(limit, 'Limit'), unit: unit.trim() } });
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
        onClose(); }} title={tracker ? 'Edit tracker' : 'Add tracker'} description="Schedule changes apply from today. Previous plans and logged intake are preserved."><ScrollView keyboardShouldPersistTaps="handled"><YStack gap={18} paddingBottom={26}><Field label="Name" value={name} onChange={setName}/><Choices label="Category" values={['supplement', 'medication']} value={category} onChange={v => setCategory(v as 'supplement' | 'medication')}/><Choices label="Metric type" values={['creatine', 'fiber', 'caffeine', 'other']} value={metric} onChange={v => setMetric(v as MetricType)}/><Text color="#aaa" fontSize={12}>Metric type identifies what is tracked. Custom medications and supplements are not scored physiologically.</Text><Choices label="Compatible unit" values={compatibleUnits(unit)} value={unit} onChange={changeUnit}/>{!tracker && <Field label="Custom unit (optional)" value={unit} onChange={setUnit}/>}<Field label="Saved dose (optional)" value={dose} onChange={setDose}/><Field label="Quantity target (optional)" value={target} onChange={setTarget}/><Field label="Quantity limit (optional)" value={limit} onChange={setLimit}/><Choices label="Frequency" values={['as-needed', 'scheduled']} value={mode} onChange={v => setMode(v as 'as-needed' | 'scheduled')}/>{mode === 'as-needed' ? <Text color="#aaa" fontSize={13}>No required doses or missed-dose reminders. You can log intake whenever taken.</Text> : <YStack gap={16}><Text color="#aaa" fontFamily="$mono" fontSize={11}>PLANNED DAYS</Text><XStack flexWrap="wrap" gap={8}>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label, i) => <Action key={i} label={label} selected={days.includes(i)} onPress={() => setDays(days.includes(i) ? days.filter(x => x !== i) : [...days, i])}/>)}</XStack>{rows.map((r, i) => <YStack key={r.id} gap={12} borderTopWidth={1} borderColor="#333" paddingTop={14}><Text color={ink}>Dose {i + 1} · {r.unit}</Text><XStack gap={12} flexWrap="wrap"><YStack flex={1} minWidth={100}><Field label={`Dose ${i + 1} time`} value={r.time} onChange={time => setRows(rows.map(x => x.id === r.id ? { ...x, time } : x))}/></YStack><YStack flex={1} minWidth={100}><Field label={`Dose ${i + 1} amount`} value={r.amount} onChange={amount => setRows(rows.map(x => x.id === r.id ? { ...x, amount } : x))}/></YStack></XStack><Action label={`Remove dose ${i + 1}`} onPress={() => setRows(rows.filter(x => x.id !== r.id))}/></YStack>)}<Action label="Multiple doses +" onPress={() => setRows([...rows, { id: randomUUID(), time: '', amount: '', unit }])}/></YStack>}<Failure message={error}/><XStack gap={12}><Action label={pending ? 'Saving…' : 'Save tracker'} disabled={pending} onPress={() => void save()}/><Action label="Cancel" disabled={pending} onPress={onClose}/></XStack></YStack></ScrollView></PitwallSheet>;
}
