jest.mock('react-native', () => ({ Platform: { OS: 'ios' }, Linking: { openSettings: jest.fn() } }));
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(), requestPermissionsAsync: jest.fn(), setNotificationChannelAsync: jest.fn(), setNotificationHandler: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(), cancelScheduledNotificationAsync: jest.fn(), scheduleNotificationAsync: jest.fn(),
  getLastNotificationResponseAsync: jest.fn(), clearLastNotificationResponseAsync: jest.fn(), addNotificationResponseReceivedListener: jest.fn(),
  AndroidImportance: { DEFAULT: 3 }, IosAuthorizationStatus: { PROVISIONAL: 3 }, SchedulableTriggerInputTypes: { DATE: 'date' },
}));
import { Platform } from 'react-native';
import * as notifications from 'expo-notifications';
import { plannedReminderRequests, reconcileDoseReminders, clearDoseReminders, listenForDoseReminder, reminderPermission } from '../reminders';
import type { DropsSnapshot } from '../types';
const n = notifications as jest.Mocked<typeof notifications>;
const now = new Date('2026-10-04T17:00:00Z'); // noon Chicago
function snapshot(): DropsSnapshot {
  return { trackers: [{ id: 't', name: 'Supplement', metricType: 'other', category: 'supplement', unit: 'g', savedDose: 5, archived: false,
    plans: [{ id: 'p', effectiveFrom: '2026-01-01', mode: 'scheduled', days: [0], unit: 'g', target: null, limit: null,
      doses: [{ id: 'morning', time: '09:00', amount: 5000, unit: 'mg' }, { id: 'evening', time: '18:00', amount: 10000, unit: 'mg' }] }] }],
    entries: [{ id: 'e', trackerId: 't', storageKind: 'tracker', name: 'Supplement', amount: 7, unit: 'g', day: '2026-10-04', consumedAt: now.toISOString(), consumedAtUtc: now.toISOString(), legacyLocal: null, note: '', version: 1 }],
    primaryTrackerId: 't', preferences: { timezone: 'America/Chicago', waterPresets: [], prominentPresetIds: [], remindersEnabled: true, caffeineHalfLifeHours: 5, bedtime: '22:00', priorUse: { creatine: 'unknown', caffeine: 'unknown' } } };
}
beforeEach(() => {
  jest.clearAllMocks(); (Platform as any).OS = 'ios';
  n.getPermissionsAsync.mockResolvedValue({ granted: true } as any);
  n.requestPermissionsAsync.mockResolvedValue({ granted: false, status: 'denied' } as any);
  n.getAllScheduledNotificationsAsync.mockResolvedValue([]);
  n.getLastNotificationResponseAsync.mockResolvedValue(null);
  n.clearLastNotificationResponseAsync.mockResolvedValue(undefined);
  n.addNotificationResponseReceivedListener.mockReturnValue({ remove: jest.fn() } as any);
});
test('unequal-dose remainder uses tracker quantity unit and exact future slot', () => {
  const requests = plannedReminderRequests(snapshot(), now);
  expect(requests).toHaveLength(1); expect(requests[0]).toMatchObject({ amount: 8, unit: 'g', trackerId: 't' });
  expect(requests[0].at.toISOString()).toBe('2026-10-04T23:00:00.000Z');
  const undone = snapshot(); undone.entries = [];
  expect(plannedReminderRequests(undone, now)).toHaveLength(1); // past morning never catches up
});
test('archived, as-needed, disabled and completed plans schedule nothing', () => {
  const s = snapshot(); s.trackers[0].archived = true; expect(plannedReminderRequests(s, now)).toEqual([]);
  s.trackers[0].archived = false; s.trackers[0].plans[0].mode = 'as-needed'; expect(plannedReminderRequests(s, now)).toEqual([]);
  s.trackers[0].plans[0].mode = 'scheduled'; s.preferences.remindersEnabled = false; expect(plannedReminderRequests(s, now)).toEqual([]);
  s.preferences.remindersEnabled = true; s.entries[0].amount = 15; expect(plannedReminderRequests(s, now)).toEqual([]);
});
test('repeated reconcile does not duplicate existing request; stale requests cancel without touching unrelated notifications', async () => {
  const s = snapshot(), id = plannedReminderRequests(s, now)[0].id;
  n.getAllScheduledNotificationsAsync.mockResolvedValue([{ identifier: id, content: { data: {} } }, { identifier: 'drops:dose:obsolete', content: { data: {} } }, { identifier: 'other-app', content: { data: {} } }] as any);
  await reconcileDoseReminders(s, now);
  expect(n.scheduleNotificationAsync).not.toHaveBeenCalled();
  expect(n.cancelScheduledNotificationAsync.mock.calls).toEqual([['drops:dose:obsolete']]);
});
test('plan-time edits replace stale exact slot, including same dose identity and remainder', async () => {
  const old = snapshot(), oldId = plannedReminderRequests(old, now)[0].id;
  const changed = snapshot(); changed.trackers[0].plans[0].doses[1].time = '19:00';
  n.getAllScheduledNotificationsAsync.mockResolvedValue([{ identifier: oldId, content: { data: {} } }] as any);
  await reconcileDoseReminders(changed, now);
  expect(n.cancelScheduledNotificationAsync).toHaveBeenCalledWith(oldId);
  expect(n.scheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({ trigger: expect.objectContaining({ date: new Date('2026-10-05T00:00:00Z') }) }));
});
test('permission denial cancels pending reminders and does not report a scheduled result', async () => {
  n.getPermissionsAsync.mockResolvedValue({ granted: false, status: 'denied' } as any);
  n.getAllScheduledNotificationsAsync.mockResolvedValue([{ identifier: 'drops:dose:old', content: { data: {} } }] as any);
  await reconcileDoseReminders(snapshot(), now);
  expect(n.cancelScheduledNotificationAsync).toHaveBeenCalledWith('drops:dose:old'); expect(n.scheduleNotificationAsync).not.toHaveBeenCalled();
  expect(await reminderPermission(true)).toBe('denied');
});
test('newer clear invalidates an in-flight reconcile before it can schedule', async () => {
  let resolve!: (v: any) => void;
  n.getPermissionsAsync.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  const pending = reconcileDoseReminders(snapshot(), now);
  await Promise.resolve(); await Promise.resolve();
  const clear = clearDoseReminders(); resolve({ granted: true });
  await Promise.all([pending, clear]); expect(n.scheduleNotificationAsync).not.toHaveBeenCalled();
});
test('tap opens prefilled sheet once, clears response and never writes intake; disposal ignores callbacks', async () => {
  const open = jest.fn(); const dispose = listenForDoseReminder(open);
  const handle = n.addNotificationResponseReceivedListener.mock.calls[0][0];
  const response = { notification: { request: { identifier: 'tap-test', content: { data: { type: 'drops_dose', trackerId: 't', amount: 8, unit: 'g' } } } } } as any;
  handle(response); handle(response); expect(open.mock.calls).toEqual([[{ trackerId: 't', amount: 8, unit: 'g' }]]);
  expect(n.clearLastNotificationResponseAsync).toHaveBeenCalledTimes(1); expect(n.scheduleNotificationAsync).not.toHaveBeenCalled();
  dispose(); handle({ ...response, notification: { request: { ...response.notification.request, identifier: 'after-dispose' } } }); expect(open).toHaveBeenCalledTimes(1);
});
test('browser is honestly unsupported and never calls notification APIs', async () => {
  (Platform as any).OS = 'web'; expect(await reminderPermission(true)).toBe('unsupported');
  await reconcileDoseReminders(snapshot(), now); await clearDoseReminders();
  expect(n.getPermissionsAsync).not.toHaveBeenCalled(); expect(n.scheduleNotificationAsync).not.toHaveBeenCalled();
});
test('foreground handler presents native notifications silently; web initialization never installs native handler', async () => {
  jest.isolateModules(() => { require('../reminders'); });
  const handler = n.setNotificationHandler.mock.calls[0][0]!;
  expect(await handler.handleNotification({} as any)).toMatchObject({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false });
  n.setNotificationHandler.mockClear(); (Platform as any).OS = 'web';
  jest.isolateModules(() => { require('../reminders'); });
  expect(n.setNotificationHandler).not.toHaveBeenCalled();
});
test('Android channel is created before permission request and malformed taps are ignored', async () => {
  (Platform as any).OS = 'android'; await reminderPermission(true);
  expect(n.setNotificationChannelAsync).toHaveBeenCalledWith('doses', expect.any(Object));
  expect(n.setNotificationChannelAsync.mock.invocationCallOrder[0]).toBeLessThan(n.requestPermissionsAsync.mock.invocationCallOrder[0]);
  const open = jest.fn(), dispose = listenForDoseReminder(open);
  const handle = n.addNotificationResponseReceivedListener.mock.calls[0][0];
  for (const amount of [-1, 0, NaN, Infinity]) handle({ notification: { request: { identifier: `invalid-${amount}`, content: { data: { type: 'drops_dose', trackerId: 't', amount, unit: 'g' } } } } } as any);
  expect(open).not.toHaveBeenCalled(); dispose();
});
