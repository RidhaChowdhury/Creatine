import React, { useMemo, useState } from 'react';
import { Button, Text, XStack, YStack, ScrollView } from 'tamagui';
import { Droplet, Pill, Coffee, SlidersHorizontal } from 'lucide-react-native';
import { randomUUID } from 'expo-crypto';
import { useDrops } from '@/features/drops/DropsProvider';
import { addDays, dayInZone } from '@/lib/drops/dates';
import type { DropsEntry, MutationReceipt } from '@/lib/drops/types';
import { PitwallSheet } from '@/components/pitwall/PitwallOverlays';
import { EntryEditor } from './EntryEditor';
import { Screen, StateGate, Action, Field, Failure, ink } from './ui';
export default function HistoryScreen() { return <StateGate><HistoryReady /></StateGate>; }
function HistoryReady() {
    const d = useDrops(), s = d.snapshot!, today = dayInZone(d.now, s.preferences.timezone);
    const [ids, setIds] = useState<string[]>([]), [range, setRange] = useState(7), [from, setFrom] = useState(addDays(today, -6)), [to, setTo] = useState(today), [draftFrom, setDraftFrom] = useState(from), [draftTo, setDraftTo] = useState(to), [filters, setFilters] = useState(false), [custom, setCustom] = useState(false), [editing, setEditing] = useState<DropsEntry>(), [receipt, setReceipt] = useState<MutationReceipt>(), [message, setMessage] = useState<string | null>(null), [error, setError] = useState<string | null>(null), [pending, setPending] = useState(false);
    const lock = React.useRef(false);
    const rows = useMemo(() => s.entries.filter(e => e.day >= from && e.day <= to && (!ids.length || ids.includes(e.trackerId))).sort((a, b) => b.day.localeCompare(a.day) || (b.consumedAtUtc ?? b.consumedAt).localeCompare(a.consumedAtUtc ?? a.consumedAt)), [s.entries, from, to, ids]);
    const groups = [...new Set(rows.map(e => e.day))];
    function toggle(id: string) { setIds(ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]); }
    function saved(r: MutationReceipt) { setReceipt(r); setError(null); if (r.after && (r.after.day < from || r.after.day > to || ids.length && !ids.includes(r.after.trackerId)))
        setMessage(`Updated entry moved to ${r.after.day} · ${r.after.name}, outside this filter.`);
    else
        setMessage(r.kind === 'delete' ? 'Intake deleted.' : 'Intake updated.'); }
    async function undo() { if (!receipt || lock.current)
        return; lock.current = true; setPending(true); try {
        await d.undo(receipt, randomUUID());
        setReceipt(undefined);
        setMessage('Exact intake restored.');
        setError(null);
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        lock.current = false;
        setPending(false);
    } }
    function applyDates() { try {
        addDays(draftFrom, 0);
        addDays(draftTo, 0);
        if (draftFrom > draftTo)
            throw new Error('Start date must be before the end date.');
        setFrom(draftFrom);
        setTo(draftTo);
        setRange(0);
        setCustom(false);
        setError(null);
    }
    catch (e) {
        setError((e as Error).message);
    } }
    return <Screen title="History"><XStack gap={8} flexWrap="wrap"><Action label="All" selected={!ids.length} onPress={() => setIds([])}/>{s.trackers.filter(t => t.id === 'builtin:water' || t.id === s.primaryTrackerId).map(t => <Action key={t.id} label={t.name} selected={ids.includes(t.id)} onPress={() => toggle(t.id)}/>)}<Button minWidth={44} minHeight={44} borderRadius={0} backgroundColor="transparent" borderColor="#444" onPress={() => setFilters(true)} aria-label="Filter all trackers"><SlidersHorizontal size={20} color={ink}/></Button></XStack><XStack gap={8} flexWrap="wrap">{[7, 30, 90].map(n => <Action key={n} label={`${n} days`} selected={range === n} onPress={() => { setRange(n); setFrom(addDays(today, 1 - n)); setTo(today); }}/>)}<Action label="Custom dates" selected={range === 0} onPress={() => { setDraftFrom(from); setDraftTo(to); setCustom(true); }}/></XStack><Text color="#aaa" fontFamily="$mono" fontSize={11}>{from} — {to} · {rows.length} entries</Text><Failure message={error}/>{message && <YStack gap={10}><Text color={ink} role="status">{message}</Text>{receipt && <Action label={pending ? 'Undoing…' : 'Undo exact change'} disabled={pending} onPress={() => void undo()}/>}</YStack>}{!rows.length && <YStack paddingVertical={30} gap={12}><Text color={ink}>No entries in this range.</Text><Text color="#aaa">Change your dates or tracker filters to see older records.</Text></YStack>}{groups.map(day => <YStack key={day} gap={0}><XStack paddingVertical={16} borderBottomWidth={1} borderColor="#333" justifyContent="space-between"><Text color={ink} fontFamily="$body" fontWeight="600">{day === today ? 'Today' : day === addDays(today, -1) ? 'Yesterday' : day} <Text color="#aaa">{day === today || day === addDays(today, -1) ? `· ${day}` : ''}</Text></Text><Text color="#aaa" fontFamily="$mono" fontSize={11}>{rows.filter(e => e.day === day).length} entries</Text></XStack>{rows.filter(e => e.day === day).map(e => { const tracker = s.trackers.find(t => t.id === e.trackerId), Icon = e.trackerId === 'builtin:water' ? Droplet : tracker?.metricType === 'caffeine' ? Coffee : Pill; let time = e.legacyLocal?.slice(11, 16) ?? e.consumedAt.slice(11, 16); if (e.consumedAtUtc)
        time = new Date(e.consumedAtUtc).toLocaleTimeString([], { timeZone: s.preferences.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); return <Button key={`${e.storageKind}:${e.id}`} unstyled minHeight={76} paddingVertical={16} borderBottomWidth={1} borderColor="#333" onPress={() => setEditing(e)} aria-label={`Edit ${e.name}, ${e.amount} ${e.unit}, ${time}`}><XStack alignItems="center" gap={16} width="100%"><Icon color={ink} size={25}/><YStack flex={1} minWidth={0} gap={6}><Text color={ink} fontSize={17}>{e.name}</Text><Text color="#aaa" fontFamily="$mono" fontSize={11}>{time}{e.note ? ' · ' + e.note : ''}</Text></YStack><XStack alignItems="baseline" gap={7} maxWidth="45%"><Text color={ink} fontFamily="$display" fontWeight="600" fontSize={35} flexShrink={1}>{e.amount}</Text><Text color="#aaa" fontFamily="$mono" fontSize={12}>{e.unit}</Text></XStack></XStack></Button>; })}</YStack>)}{editing && <EntryEditor entry={editing} onClose={() => setEditing(undefined)} onSaved={saved}/>}<PitwallSheet open={filters} onOpenChange={setFilters} title="Tracker filters" description="Includes archived trackers. Select any combination; All clears filters."><ScrollView><YStack gap={10}><Action label="All trackers" selected={!ids.length} onPress={() => setIds([])}/>{s.trackers.map(t => <Action key={t.id} label={`${t.name}${t.archived ? ' (archived)' : ''}${ids.includes(t.id) ? ' ✓' : ''}`} selected={ids.includes(t.id)} onPress={() => toggle(t.id)}/>)}<Action label="Apply filters" onPress={() => setFilters(false)}/></YStack></ScrollView></PitwallSheet><PitwallSheet open={custom} onOpenChange={setCustom} title="Custom date range"><YStack gap={16}><Field label="From date" value={draftFrom} onChange={setDraftFrom} placeholder="YYYY-MM-DD"/><Field label="To date" value={draftTo} onChange={setDraftTo} placeholder="YYYY-MM-DD"/><Failure message={error}/><Action label="Apply date range" onPress={applyDates}/><Action label="Cancel" onPress={() => setCustom(false)}/></YStack></PitwallSheet></Screen>;
}
