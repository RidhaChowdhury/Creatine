import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { EntryEditor } from '../EntryEditor';
const mockConfirm = jest.fn();
const mockAdd = jest.fn();
const mockClose = jest.fn();
const mockSaved = jest.fn();
const mockNow = new Date('2026-10-04T12:00:00Z');
const mockSnapshot = { trackers: [{ id: 'builtin:water', name: 'Water', unit: 'oz', archived: false }], preferences: { timezone: 'UTC' } };
jest.mock('@/features/drops/DropsProvider', () => ({ useDrops: () => ({ snapshot: mockSnapshot, now: mockNow, add: mockAdd }) }));
jest.mock('@/components/FeedbackProvider', () => ({ useFeedback: () => ({ prime: jest.fn(), confirm: mockConfirm }) }));
jest.mock('@/components/pitwall/PitwallOverlays', () => ({ PitwallSheet: ({ children }: any) => children }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'operation-one' }));
jest.mock('tamagui', () => { const React = require('react'); const primitive = (tag: string) => (props: any) => React.createElement(tag, props, props.children); return { Button: primitive('button'), Text: primitive('text'), Input: primitive('input'), YStack: primitive('stack'), XStack: primitive('row'), ScrollView: primitive('scroll') }; });
let renderer: TestRenderer.ReactTestRenderer;
beforeEach(() => { jest.clearAllMocks(); (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(async () => { if (renderer)
    await act(async () => renderer.unmount()); });
async function mount() { await act(async () => { renderer = TestRenderer.create(<EntryEditor prefill={{ trackerId: 'builtin:water', amount: 8, unit: 'oz' }} onClose={mockClose} onSaved={mockSaved}/>); }); }
const save = () => renderer.root.findByProps({ 'aria-label': 'Save intake' }).props.onPress();
test('one pending intent writes once; failure keeps input and emits no success feedback', async () => {
    let reject!: (reason: Error) => void;
    mockAdd.mockImplementation(() => new Promise((_resolve, r) => { reject = r; }));
    await mount();
    await act(async () => { save(); save(); });
    expect(mockAdd).toHaveBeenCalledTimes(1);
    expect(mockConfirm).not.toHaveBeenCalled();
    await act(async () => reject(new Error('Database unavailable')));
    expect(mockClose).not.toHaveBeenCalled();
    expect(mockSaved).not.toHaveBeenCalled();
    expect(mockConfirm).not.toHaveBeenCalled();
    expect(renderer.root.findByProps({ 'aria-label': 'Amount' }).props.value).toBe('8');
    expect(renderer.root.findByProps({ role: 'alert' }).props.children).toBe('Database unavailable');
});
test('future timestamps are rejected before persistence', async () => {
    await mount();
    await act(async () => renderer.root.findByProps({ 'aria-label': 'Consumption date and time' }).props.onChangeText('2026-10-04T13:00:00'));
    await act(async () => save());
    expect(mockAdd).not.toHaveBeenCalled();
    expect(mockConfirm).not.toHaveBeenCalled();
    expect(mockClose).not.toHaveBeenCalled();
    expect(renderer.root.findByProps({ role: 'alert' }).props.children).toBe('Consumption time cannot be in the future.');
});
test('successful persistence returns the exact receipt before confirmation and dismissal', async () => {
    const receipt = { operationId: 'operation-one', kind: 'add', before: null, after: { id: 'saved-id', storageKind: 'intake', trackerId: 'builtin:water' } };
    mockAdd.mockResolvedValue(receipt);
    await mount();
    await act(async () => save());
    expect(mockAdd).toHaveBeenCalledWith({ trackerId: 'builtin:water', amount: 8, unit: 'oz', consumedAt: '2026-10-04T12:00:00.000Z', note: '' }, 'operation-one');
    expect(mockSaved).toHaveBeenCalledWith(receipt);
    expect(mockConfirm).toHaveBeenCalledWith('water');
    expect(mockClose).toHaveBeenCalledTimes(1);
});
