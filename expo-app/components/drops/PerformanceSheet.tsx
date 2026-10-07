import React, { useEffect, useRef, useState } from 'react';
import { findNodeHandle, Platform, Share, View } from 'react-native';
import { Button, ScrollView, Text, XStack, YStack } from 'tamagui';
import { useDrops } from '@/features/drops/DropsProvider';
import { evaluatePerformance } from '@/lib/drops/performance';
import { PitwallSheet } from '@/components/pitwall/PitwallOverlays';
import { DataChart } from './DataChart';

export default function PerformanceSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { snapshot, now, status, error } = useDrops();
  const [shareError, setShareError] = useState<string | null>(null);
  const [sharePreview, setSharePreview] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const sharingRef = useRef(false);
  const anchor = useRef<View>(null);
  useEffect(() => { if (!open) { setSharePreview(null); setShareError(null); } }, [open]);
  async function confirmShare() {
    if (!sharePreview || sharingRef.current) return;
    const message = sharePreview;
    sharingRef.current = true; setSharing(true); setShareError(null);
    try {
      if (Platform.OS === 'web') {
        if (typeof navigator === 'undefined' || !navigator.share) { setShareError('Sharing is unavailable. Select and copy the preview text below.'); return; }
        await navigator.share({ text: message });
      } else {
        const handle = Platform.OS === 'ios' ? findNodeHandle(anchor.current) : null;
        const response = await Share.share({ message }, handle ? { anchor: handle } : undefined);
        if (response.action === Share.dismissedAction) return;
      }
      setSharePreview(null);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setShareError('Sharing is unavailable. Select and copy the preview text below.');
    } finally { sharingRef.current = false; setSharing(false); }
  }
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
        <Button minHeight={44} accessibilityLabel="Preview Performance summary to share" onPress={() => { setShareError(null); setSharePreview(`Drops Performance: ${result.label}\nAs of: ${result.asOf}`); }}>Share summary</Button>
        <Text color="#888" fontSize={12}>Optional share contains only the status label and time. Review the exact text before sharing.</Text>
        {sharePreview && <YStack gap={12} borderWidth={1} borderColor="#454545" padding={16}>
          <Text color="#e9e9e9">Share preview</Text>
          <Text selectable color="#e9e9e9" accessibilityLabel="Exact Performance share text">{sharePreview}</Text>
          <XStack gap={12} flexWrap="wrap">
            <Button ref={anchor} minHeight={44} disabled={sharing} accessibilityLabel="Confirm sharing Performance preview" onPress={confirmShare}>{sharing ? 'Sharing…' : 'Confirm share'}</Button>
            <Button minHeight={44} disabled={sharing} accessibilityLabel="Cancel Performance share" onPress={() => { setSharePreview(null); setShareError(null); }}>Cancel</Button>
          </XStack>
        </YStack>}
        {shareError && <Text color="#ff9494">{shareError}</Text>}
      </>}
    </YStack></ScrollView>
  </PitwallSheet>;
}
export { PerformanceSheet };
