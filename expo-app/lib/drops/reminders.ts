import { Platform, Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { DropsSnapshot } from './types';
import { addDays, dayInZone, wallTimeToInstant } from './dates';
import { dailyProgress } from './domain';

const PREFIX = 'drops:dose:';
if (Platform.OS === 'ios' || Platform.OS === 'android') {
  Notifications.setNotificationHandler({ handleNotification: async () => ({
    shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true,
  }) });
}
let queue: Promise<unknown> = Promise.resolve();
let generation = 0;
export type ReminderStatus = 'granted' | 'denied' | 'undetermined' | 'unsupported';
export async function reminderPermission(request = false): Promise<ReminderStatus> {
  if (Platform.OS === 'web') return 'unsupported';
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('doses', { name: 'Scheduled doses', importance: Notifications.AndroidImportance.DEFAULT });
  const result = request ? await Notifications.requestPermissionsAsync() : await Notifications.getPermissionsAsync();
  return result.granted || result.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL ? 'granted' : result.status === 'denied' ? 'denied' : 'undetermined';
}
export function openReminderSettings() { return Linking.openSettings(); }
export function plannedReminderRequests(snapshot: DropsSnapshot, now: Date) {
  const requests: { id: string; at: Date; trackerId: string; amount: number; unit: string; name: string }[] = [];
  if (!snapshot.preferences.remindersEnabled) return requests;
  const zone = snapshot.preferences.timezone;
  const today = dayInZone(now.toISOString(), zone);
  for (let i = 0; i < 7; i++) {
    const day = addDays(today, i);
    for (const tracker of snapshot.trackers.filter(t => !t.archived && t.metricType !== 'water')) {
      const progress = dailyProgress(tracker, snapshot.entries, day);
      for (const item of progress.doses) {
        if (item.complete || item.remaining <= 0) continue;
        let at: Date;
        try { at = new Date(wallTimeToInstant(`${day}T${item.dose.time}:00`, zone)); }
        catch { continue; /* No invented instant at a DST gap or repeated hour. */ }
        if (at.getTime() <= now.getTime()) continue; // Undo of a past dose is overdue, never catch-up notification.
        requests.push({ id: `${PREFIX}${tracker.id}:${day}:${item.dose.id}:${item.remaining}:${zone}:${at.toISOString()}:${encodeURIComponent(tracker.unit)}:${encodeURIComponent(tracker.name)}`, at,
          trackerId: tracker.id, amount: item.remaining, unit: tracker.unit, name: tracker.name });
      }
    }
  }
  return requests.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, 60);
}
export function clearDoseReminders(): Promise<void> {
  const current = ++generation;
  const run = async () => {
    if (Platform.OS === 'web' || current !== generation) return;
    for (const item of await Notifications.getAllScheduledNotificationsAsync()) {
      if (item.identifier.startsWith(PREFIX) || ['creatine_reminder'].includes(String(item.content.data?.type))) await Notifications.cancelScheduledNotificationAsync(item.identifier);
    }
  };
  const result = queue.then(run, run); queue = result.catch(() => {}); return result;
}
export function reconcileDoseReminders(snapshot: DropsSnapshot, now: Date): Promise<void> {
  const current = ++generation;
  const run = async () => {
    if (Platform.OS === 'web' || current !== generation) return;
    const allowed = snapshot.preferences.remindersEnabled && await reminderPermission() === 'granted';
    const requests = allowed ? plannedReminderRequests(snapshot, now) : [];
    const wanted = new Map(requests.map(r => [r.id, r]));
    const existing = await Notifications.getAllScheduledNotificationsAsync();
    if (current !== generation) return;
    for (const item of existing) {
      if (item.identifier.startsWith(PREFIX) && !wanted.has(item.identifier) || item.content.data?.type === 'creatine_reminder') await Notifications.cancelScheduledNotificationAsync(item.identifier);
    }
    const ids = new Set(existing.map(r => r.identifier));
    for (const request of requests) {
      if (current !== generation) return;
      if (ids.has(request.id)) continue;
      await Notifications.scheduleNotificationAsync({ identifier: request.id,
        content: { title: 'Scheduled dose', body: `${request.name} · ${request.amount} ${request.unit} remaining`,
          data: { type: 'drops_dose', trackerId: request.trackerId, amount: request.amount, unit: request.unit }, sound: false },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: request.at, channelId: 'doses' } });
    }
  };
  const result = queue.then(run, run); queue = result.catch(() => {}); return result;
}
let lastResponse: string | null = null;
export function listenForDoseReminder(open: (prefill: {trackerId: string; amount: number; unit: string}) => void) {
  if (Platform.OS === 'web') return () => {};
  let active = true;
  const handle = (response: Notifications.NotificationResponse | null) => {
    if (!active || !response || response.notification.request.identifier === lastResponse) return;
    const data = response.notification.request.content.data;
    if (data?.type !== 'drops_dose' || typeof data.trackerId !== 'string' || !data.trackerId || typeof data.amount !== 'number' || !Number.isFinite(data.amount) || data.amount <= 0 || typeof data.unit !== 'string' || !data.unit) return;
    lastResponse = response.notification.request.identifier;
    open({ trackerId: data.trackerId, amount: data.amount, unit: data.unit });
    void Notifications.clearLastNotificationResponseAsync().catch(() => {});
  };
  void Notifications.getLastNotificationResponseAsync().then(handle).catch(() => {});
  const listener = Notifications.addNotificationResponseReceivedListener(handle);
  return () => { active = false; listener.remove(); };
}
