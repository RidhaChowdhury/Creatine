import React, { useState } from 'react';
import { Share } from 'react-native';
import { Button, ScrollView, Text, XStack, YStack } from 'tamagui';
import { useDrops } from '@/features/drops/DropsProvider';
import { evaluatePerformance } from '@/lib/drops/performance';
import { PitwallSheet } from '@/components/pitwall/PitwallOverlays';
import { DataChart } from './DataChart';

export default function PerformanceSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { snapshot, now, status, error } = useDrops();
  const [shareError, setShareError] = useState<string | null>(null);
  const result = snapshot ? evaluatePerformance(snapshot, now) : null;
  return <PitwallSheet open={open} onOpenChange={onOpenChange} title="Performance" description="Physical readiness · intake context">
    <ScrollView><YStack gap={22} paddingBottom={40}>
      {!result ? <Text color="#aaa">{status === 'error' ? error : 'Loading intake context…'}</Text> : <>
        <Text color="#e9e9e9" fontSize={28}>{result.label}</Text>
        <Text color="#aaa">A readiness score or baseline range cannot be supported from intake alone.</Text>
        {result.contributors.map(c => <YStack key={c.key} gap={6} paddingVertical={12} borderBottomWidth={1} borderColor="#333">
          <XStack justifyContent="space-between"><Text color="#e9e9e9">{c.label}</Text><Text color="#398eff">{c.value === null ? 'Unknown' : Number(c.value.toFixed(1))} {c.value === null ? '' : c.unit}</Text></XStack>
          <Text color="#aaa" fontSize={12}>{c.coverage}</Text><Text color="#aaa">{c.detail}</Text>
        </YStack>)}
        <Text color="#e9e9e9">Known-dose caffeine · last / next 12 hours</Text>
        <DataChart points={result.timeline.map(p => ({ label: new Date(p.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: snapshot!.preferences.timezone }), value: p.caffeineMg, detail: `${p.planned ? 'Planned scenario' : 'Recorded-dose model'} · readiness unavailable` }))} unit="mg" nowIndex={24} />
        {result.reasons.map((reason, i) => <Text key={i} color="#aaa" fontSize={13}>{reason}</Text>)}
        <Text color="#888" fontSize={11}>{result.modelVersion} · {result.asOf}</Text>
        <Button accessibilityLabel="Share Performance summary without intake records" onPress={async () => {
          try { await Share.share({ message: `Drops Performance: readiness unavailable. Intake alone does not support a physical readiness score. Model ${result.modelVersion}. No intake, medications or personal details included.` }); }
          catch { setShareError('Sharing is unavailable on this device.'); }
        }}>Share summary</Button>
        <Text color="#888" fontSize={12}>Optional share contains only the model status. Individual records and tracker names are omitted.</Text>
        {shareError && <Text color="#ff9494">{shareError}</Text>}
      </>}
    </YStack></ScrollView>
  </PitwallSheet>;
}
export { PerformanceSheet };
