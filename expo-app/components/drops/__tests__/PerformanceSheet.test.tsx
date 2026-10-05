import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Platform, Share } from 'react-native';
import PerformanceSheet from '../PerformanceSheet';
const mockResult = { label: 'Insufficient data', asOf: '2026-10-04T12:00:00.000Z', modelVersion: 'private-model', contributors: [], timeline: [], reasons: [] };
jest.mock('@/features/drops/DropsProvider', () => ({ useDrops: () => ({ snapshot: { preferences: { timezone: 'UTC' }, entries: [{ id: 'raw-private-id', note: 'medication-private' }], trackers: [{ name: 'Medication name' }] }, now: new Date(), status: 'ready' }) }));
jest.mock('@/lib/drops/performance', () => ({ evaluatePerformance: () => mockResult }));
jest.mock('@/components/pitwall/PitwallOverlays', () => ({ PitwallSheet: ({ children }: any) => children }));
jest.mock('../DataChart', () => ({ DataChart: () => null }));
jest.mock('tamagui', () => { const React = require('react'); const primitive = (tag: string) => React.forwardRef((props: any, ref: any) => React.createElement(tag, { ...props, ref }, props.children)); return { Button: primitive('button'), Text: primitive('text'), YStack: primitive('stack'), XStack: primitive('row'), ScrollView: primitive('scroll') }; });
let tree: TestRenderer.ReactTestRenderer;
const press = async (label: string) => { await act(async () => tree.root.findByProps({ accessibilityLabel: label }).props.onPress()); };
const preview = () => tree.root.findByProps({ accessibilityLabel: 'Exact Performance share text' }).props.children;
beforeEach(async () => { jest.clearAllMocks(); (Platform as any).OS = 'android'; jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction }); await act(async () => { tree = TestRenderer.create(<PerformanceSheet open onOpenChange={jest.fn()} />); }); });
afterEach(async () => { await act(async () => tree.unmount()); jest.restoreAllMocks(); });
test('preview is privacy-minimal and cancel never invokes platform sharing', async () => {
  await press('Preview Performance summary to share');
  expect(preview()).toBe('Drops Performance: Insufficient data\nAs of: 2026-10-04T12:00:00.000Z');
  expect(preview()).not.toMatch(/medication|raw-private-id|private-model|Medication name/);
  expect(Share.share).not.toHaveBeenCalled(); await press('Cancel Performance share');
  expect(Share.share).not.toHaveBeenCalled(); expect(tree.root.findAllByProps({ accessibilityLabel: 'Exact Performance share text' })).toHaveLength(0);
});
test('confirm sends the exact frozen preview even if model changes', async () => {
  await press('Preview Performance summary to share'); const exact = preview();
  const original = mockResult.asOf; mockResult.asOf = 'later';
  await press('Confirm sharing Performance preview'); mockResult.asOf = original;
  expect(Share.share).toHaveBeenCalledWith({ message: exact }, undefined);
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Exact Performance share text' })).toHaveLength(0);
});
test('native dismissal leaves preview without reporting successful sharing', async () => {
  (Share.share as jest.Mock).mockResolvedValue({ action: Share.dismissedAction });
  await press('Preview Performance summary to share'); await press('Confirm sharing Performance preview');
  expect(preview()).toContain('Insufficient data'); expect(JSON.stringify(tree.toJSON())).not.toMatch(/shared successfully/i);
});
test('browser without share support keeps selectable fallback and never calls native sharing', async () => {
  (Platform as any).OS = 'web'; const prior = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
  try { await press('Preview Performance summary to share'); await press('Confirm sharing Performance preview');
    expect(Share.share).not.toHaveBeenCalled(); expect(tree.root.findByProps({ accessibilityLabel: 'Exact Performance share text' }).props.selectable).toBe(true);
    expect(JSON.stringify(tree.toJSON())).toContain('Select and copy');
  } finally { if (prior) Object.defineProperty(globalThis, 'navigator', prior); else delete (globalThis as any).navigator; }
});
test('browser cancellation is quiet and retains the exact preview', async () => {
  (Platform as any).OS = 'web'; const prior = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const share = jest.fn(async () => { const error = new Error('User cancelled'); error.name = 'AbortError'; throw error; });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { share } });
  try { await press('Preview Performance summary to share'); const exact = preview(); await press('Confirm sharing Performance preview');
    expect(share).toHaveBeenCalledWith({ text: exact }); expect(preview()).toBe(exact);
    expect(JSON.stringify(tree.toJSON())).not.toMatch(/Sharing is unavailable|shared successfully/i);
  } finally { if (prior) Object.defineProperty(globalThis, 'navigator', prior); else delete (globalThis as any).navigator; }
});
