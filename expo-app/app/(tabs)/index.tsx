import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Settings } from 'lucide-react-native';
import { Button, Text, XStack, YStack } from 'tamagui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDrops } from '@/features/drops/DropsProvider';
import { useFeedback } from '@/components/FeedbackProvider';
import { PitwallDashboard } from '@/components/pitwall/PitwallDashboard';
import { WaterScene } from '@/components/pitwall/WaterScene';
import { StateGate } from '@/components/drops/ui';
import { PerformanceSheet } from '@/components/drops/PerformanceSheet';
import { dayInZone } from '@/lib/drops/dates';
import { convertAmount } from '@/lib/drops/units';
import { planForDay } from '@/lib/drops/domain';
import { evaluatePerformance } from '@/lib/drops/performance';
export default function Home() { return <StateGate><HomeReady /></StateGate>; }
function HomeReady() { const { snapshot, now } = useDrops(), f = useFeedback(), focused = useIsFocused(), router = useRouter(), inset = useSafeAreaInsets(), [performance, setPerformance] = useState(false); const s = snapshot!, day = dayInZone(now.toISOString(), s.preferences.timezone), water = s.trackers.find(t => t.id === 'builtin:water')!; const unit = water?.unit ?? 'oz', plan = planForDay(water, day), goal = plan?.target == null ? 0 : convertAmount(plan.target, plan.unit, unit), limit = plan?.limit == null ? null : convertAmount(plan.limit, plan.unit, unit); const amount = s.entries.filter(e => e.trackerId === 'builtin:water' && e.day === day).reduce((n, e) => n + convertAmount(e.amount, e.unit, unit), 0); const previous = useRef(amount), [impulse, setImpulse] = useState<{
    id: number;
    origin: number;
}>(); useEffect(() => { if (amount !== previous.current) {
    setImpulse({ id: Date.now(), origin: .5 });
    previous.current = amount;
} }, [amount]); const model = evaluatePerformance(s, now); const light = goal <= 0 || amount / goal < .99; return <YStack flex={1} minHeight={0}><PitwallDashboard waterAmount={amount} waterGoal={goal} waterLimit={limit} waterUnit={unit} onSetGoal={() => router.push('/(tabs)/settings')} renderWater={layout => <WaterScene {...layout} amount={amount} active={focused && f.active && !performance} reducedMotion={f.reducedMotion} impulse={impulse}/>}/><XStack position="absolute" top={inset.top + 22} left={24} right={24} justifyContent="space-between" alignItems="center"><Text fontFamily="$brand" fontWeight="800" fontSize={26} color={light ? '#e9e9e9' : '#0c0c0c'}>DROPS.</Text><Button aria-label="Settings" minWidth={44} minHeight={44} backgroundColor="transparent" borderWidth={0} onPress={() => router.push('/(tabs)/settings')}><Settings size={20} color={light ? '#e9e9e9' : '#0c0c0c'}/></Button></XStack><YStack position="absolute" left={24} right={24} bottom={inset.bottom + 116}><Pressable accessibilityRole="button" accessibilityLabel="Open Performance breakdown" onPress={() => setPerformance(true)} style={({pressed}) => ({width:"100%", minHeight:68, paddingVertical:16, paddingHorizontal:16, backgroundColor:"#0c0c0c", opacity:pressed ? 0.8 : 1})}><XStack flex={1} justifyContent="space-between" alignItems="center" gap={12}><YStack flex={1} gap={5}><Text color="#aaa" fontFamily="$mono" fontSize={11}>PERFORMANCE · ESTIMATE</Text><Text color="#e9e9e9" fontSize={13}>{model.label}</Text></YStack>{model.score !== null && <Text fontFamily="$display" fontSize={40} color="#e9e9e9">{Math.round(model.score)}</Text>}</XStack></Pressable></YStack><PerformanceSheet open={performance} onOpenChange={setPerformance}/></YStack>; }

