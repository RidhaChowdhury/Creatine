import React, { useState } from 'react';
import { Button, Text, XStack, YStack } from 'tamagui';
import { useDrops } from '@/features/drops/DropsProvider';
import { dayInZone } from '@/lib/drops/dates';
import { dailyProgress, planForDay } from '@/lib/drops/domain';
import type { DropsTracker } from '@/lib/drops/types';
import { Screen, StateGate, Action, Failure, ink } from './ui';
import { ProfileEditor } from './ProfileEditor';
export default function SuppsScreen() { return <StateGate><SuppsReady /></StateGate>; }
function SuppsReady() {
    const d = useDrops(), s = d.snapshot!, day = dayInZone(d.now, s.preferences.timezone);
    const [editing, setEditing] = useState<DropsTracker | null | undefined>(), [showArchive, setShowArchive] = useState(false), [pending, setPending] = useState<string | null>(null), [error, setError] = useState<string | null>(null);
    const lock = React.useRef(false);
    async function action(id: string, work: () => Promise<unknown>) { if (lock.current)
        return; lock.current = true; setPending(id); setError(null); try {
        await work();
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        lock.current = false;
        setPending(null);
    } }
    return <Screen title="Supps" action={<Action label="Add tracker" onPress={() => setEditing(null)}/>}><Text color="#aaa" fontSize={13}>Supplement and medication routines</Text><Failure message={error}/>{s.trackers.filter(t => t.category !== 'water' && (!t.archived || showArchive)).map(t => { const p = dailyProgress(t, s.entries, day), plan = planForDay(t, day); return <YStack key={t.id} role="group" aria-label={`${t.name} tracker`} gap={14} paddingVertical={20} borderTopWidth={1} borderColor="#333"><XStack justifyContent="space-between" gap={16} alignItems="baseline"><Text flex={1} fontFamily="$supplement" fontWeight="600" fontSize={34} textTransform="uppercase" color={ink}>{t.name}</Text><Text color="#398eff" fontFamily="$mono" fontSize={11}>{t.archived ? 'ARCHIVED' : t.id === s.primaryTrackerId ? 'PRIMARY' : ''}</Text></XStack><XStack gap={12} alignItems="baseline"><Text fontFamily="$display" fontSize={40} color={ink}>{p.logged}</Text><Text color="#aaa" fontFamily="$mono" fontSize={13}>{t.unit} logged today</Text></XStack>{plan?.mode === 'scheduled' && p.total > 0 ? <YStack gap={8}><XStack gap={10} flexWrap="wrap" aria-label={`${p.completed} of ${p.total} planned doses complete`}>{p.doses.map(({ dose, complete, remaining }, i) => <Button key={dose.id} unstyled minWidth={44} minHeight={44} onPress={() => d.openAdd({ trackerId: t.id, amount: remaining > 0 ? remaining : dose.amount, unit: dose.unit })} aria-label={`Dose ${i + 1} at ${dose.time}: ${complete ? 'Complete' : `${remaining} ${dose.unit} remaining`}`}><YStack alignItems="center" gap={5}><Text color={complete ? '#398eff' : '#aaa'} fontSize={22}>{complete ? '●' : '○'}</Text><Text color="#aaa" fontFamily="$mono" fontSize={10}>{dose.time}</Text></YStack></Button>)}</XStack><Text color="#aaa" fontSize={12}>{p.completed} of {p.total} complete · {p.remaining} {plan.unit} remaining{p.beyond > 0 ? ` · ${p.beyond} beyond plan` : ''}</Text></YStack> : <Text color="#aaa" fontSize={12}>{plan?.mode === 'as-needed' ? 'As needed · no required doses' : 'No doses planned today'}</Text>}<XStack gap={8} flexWrap="wrap"><Action label="Log intake" disabled={t.archived} onPress={() => d.openAdd({ trackerId: t.id, amount: t.savedDose ?? undefined, unit: t.unit })}/><Action label="Edit profile" onPress={() => setEditing(t)}/>{!t.archived && <Action label={t.id === s.primaryTrackerId ? 'Remove primary' : 'Make primary'} disabled={!!pending} onPress={() => void action(t.id, () => d.setPrimary(t.id === s.primaryTrackerId ? null : t.id))}/>}<Action label={t.archived ? 'Restore tracker' : 'Archive tracker'} disabled={!!pending} onPress={() => void action(t.id, () => d.saveProfile({ ...t, archived: !t.archived }))}/></XStack></YStack>; })}<Action label={showArchive ? 'Hide archived' : 'Show archived'} onPress={() => setShowArchive(!showArchive)}/>{editing !== undefined && <ProfileEditor tracker={editing ?? undefined} onClose={() => setEditing(undefined)}/>}</Screen>;
}

