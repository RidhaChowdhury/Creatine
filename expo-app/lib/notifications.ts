import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { store } from '@/store/store';

export const STORAGE_KEYS = {
   CREATINE_NOTIFICATIONS: 'creatine_notifications',
   WATER_NOTIFICATION_IDS: 'water_notification_ids',
   LAST_NOTIFICATION_MAINTENANCE: 'last_notification_maintenance'
} as const;

interface ScheduledNotification {
   id: string;
   date: string;
   timestamp: number;
}

Notifications.setNotificationHandler({
   handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: false
   })
});

export class NotificationService {
   static async requestPermissions(): Promise<boolean> {
      try {
         const { status } = await Notifications.requestPermissionsAsync();
         return status === 'granted';
      } catch (error) {
         console.error('Error requesting permission');
         return false;
      }
   }

   static async checkPermissions(): Promise<boolean> {
      try {
         const settings = await Notifications.getPermissionsAsync();
         return (
            settings.granted ||
            settings.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED ||
            settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL ||
            settings.ios?.status === Notifications.IosAuthorizationStatus.EPHEMERAL
         );
      } catch (error) {
         console.error('Error checking notification permissions:', error);
         return false;
      }
   }

   static async saveCreatineNotifications(notifications: ScheduledNotification[]): Promise<void> {
      try {
         await AsyncStorage.setItem(
            STORAGE_KEYS.CREATINE_NOTIFICATIONS,
            JSON.stringify(notifications)
         );
      } catch (error) {
         console.error('Error saving creatine notifications to async storage');
      }
   }

   static async getCreatineNotifications(): Promise<ScheduledNotification[]> {
      try {
         const stored = await AsyncStorage.getItem(STORAGE_KEYS.CREATINE_NOTIFICATIONS);
         return stored ? JSON.parse(stored) : [];
      } catch (error) {
         console.error('Error getting creatine notifications from async storage');
         return [];
      }
   }

   static async clearCreatineNotifications(): Promise<void> {
      try {
         await AsyncStorage.removeItem(STORAGE_KEYS.CREATINE_NOTIFICATIONS);
      } catch (error) {
         console.error('Error removing creatine notifications from async storage');
      }
   }

   static async saveWaterNotificationIds(ids: string[]): Promise<void> {
      try {
         await AsyncStorage.setItem(STORAGE_KEYS.WATER_NOTIFICATION_IDS, JSON.stringify(ids));
      } catch (error) {
         console.error('Error saving water notification ids');
      }
   }

   static async getWaterNotificationIds(): Promise<string[] | []> {
      try {
         const ids = await AsyncStorage.getItem(STORAGE_KEYS.WATER_NOTIFICATION_IDS);
         return ids ? JSON.parse(ids) : [];
      } catch (error) {
         console.error('Error getting water notification ids');
         return [];
      }
   }

   static async clearWaterNotificationIds(): Promise<void> {
      try {
         await AsyncStorage.removeItem(STORAGE_KEYS.WATER_NOTIFICATION_IDS);
      } catch (error) {
         console.error('Error clearing water notification ids');
      }
   }

   static async cancelAllCreatineNotifications(): Promise<void> {
      try {
         const notifications = await this.getCreatineNotifications();

         for (const notification of notifications) {
            await Notifications.cancelScheduledNotificationAsync(notification.id);
         }

         await this.clearCreatineNotifications();
      } catch (error) {
         console.error('Error cancelling creatine notifications:', error);
      }
   }

   static async cancelTodaysCreatineNotification(): Promise<boolean> {
      try {
         const notifications = await this.getCreatineNotifications();
         const today = new Date().toDateString();

         const todayNotification = notifications.find((n) => n.date === today);

         if (todayNotification) {
            await Notifications.cancelScheduledNotificationAsync(todayNotification.id);

            // Remove from stored list
            const updated = notifications.filter((n) => n.id !== todayNotification.id);
            await this.saveCreatineNotifications(updated);

            return true;
         }

         return false;
      } catch (error) {
         console.error("Error cancelling today's creatine notification:", error);
         return false;
      }
   }

   static async cancelCreatineReminder(): Promise<void> {
      // Keep this method for backward compatibility
      await this.cancelAllCreatineNotifications();
   }

   static async scheduleCreatineNotifications(
      reminderTime: string
   ): Promise<ScheduledNotification[]> {
      try {
         const [hours, minutes] = reminderTime.split(':').map(Number);
         const notifications: ScheduledNotification[] = [];

         // Clear existing notifications first
         await this.cancelAllCreatineNotifications();

         for (let i = 0; i < 7; i++) {
            const scheduledDate = new Date();
            scheduledDate.setDate(scheduledDate.getDate() + i);
            scheduledDate.setHours(hours, minutes, 0, 0);

            // Skip if time has already passed today
            if (i === 0 && scheduledDate < new Date()) {
               continue;
            }

            const id = await Notifications.scheduleNotificationAsync({
               content: {
                  title: '💪 Creatine Time!',
                  body: 'Time for your daily creatine supplement',
                  data: { type: 'creatine_reminder', date: scheduledDate.toDateString() }
               },
               trigger: {
                  type: Notifications.SchedulableTriggerInputTypes.DATE,
                  date: scheduledDate
               }
            });

            notifications.push({
               id,
               date: scheduledDate.toDateString(),
               timestamp: scheduledDate.getTime()
            });
         }

         await this.saveCreatineNotifications(notifications);
         return notifications;
      } catch (error) {
         console.error('Error scheduling creatine notifications:', error);
         return [];
      }
   }

   static async maintainCreatineNotifications(reminderTime: string): Promise<void> {
      try {
         // Check if we did maintenance recently (throttle to once per day)
         const lastMaintenance = await AsyncStorage.getItem(
            STORAGE_KEYS.LAST_NOTIFICATION_MAINTENANCE
         );
         const today = new Date().toDateString();

         if (lastMaintenance === today) {
            return;
         }

         const notifications = await this.getCreatineNotifications();

         // Filter out past notifications
         const now = Date.now();
         const activeNotifications = notifications.filter((n) => n.timestamp > now);

         // Reschedule if we have fewer than 3 days left
         if (activeNotifications.length < 3) {
            await this.scheduleCreatineNotifications(reminderTime);
         } else {
            // Just update storage to remove past notifications
            await this.saveCreatineNotifications(activeNotifications);
         }

         // Mark maintenance as done
         await AsyncStorage.setItem(STORAGE_KEYS.LAST_NOTIFICATION_MAINTENANCE, today);
      } catch (error) {
         console.error('Creatine notification maintenance error:', error);
      }
   }

   static async scheduleCreatineReminder(time?: string): Promise<void> {
      try {
         const hasPermission = await this.checkPermissions();
         if (!hasPermission) {
            return;
         }

         const reminderTime = time || '23:05';
         await this.scheduleCreatineNotifications(reminderTime);
      } catch (error) {
         console.error('Error scheduling creatine reminder:', error);
      }
   }

   static async cancelWaterReminders(): Promise<void> {
      try {
         const ids = await this.getWaterNotificationIds();
         for (const id of ids) {
            await Notifications.cancelScheduledNotificationAsync(id);
            await this.clearWaterNotificationIds();
         }
      } catch (error) {
         console.error('Error cancelling water notifications');
      }
   }

   static async scheduleWaterReminders(customIntervals?: number[]): Promise<void> {
      try {
         const hasPermission = await this.checkPermissions();
         if (!hasPermission) {
            return;
         }

         const intervals = customIntervals || [3, 6];

         await this.cancelWaterReminders();

         const now = new Date();
         const reminderIds: string[] = [];

         for (const delayHours of intervals) {
            const scheduledTime = new Date(now.getTime() + delayHours * 60 * 60 * 1000);

            const id = await Notifications.scheduleNotificationAsync({
               content: {
                  title: '💧 Hydration Check!',
                  body: 'Time to drink some water and log your intake'
               },
               trigger: {
                  type: Notifications.SchedulableTriggerInputTypes.DATE,
                  date: scheduledTime
               }
            });

            reminderIds.push(id);
         }

         await this.saveWaterNotificationIds(reminderIds);
      } catch (error) {
         console.error('Error scheduling water reminders:', error);
      }
   }

   // Initialization and cleanup //
   static async cleanupOrphanedNotifications(): Promise<void> {
      try {
         const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
         const scheduledIds = scheduledNotifications.map((n) => n.identifier);

         // Clean up creatine notifications
         const creatineNotifications = await this.getCreatineNotifications();
         const validCreatineNotifications = creatineNotifications.filter((n) =>
            scheduledIds.includes(n.id)
         );
         if (validCreatineNotifications.length !== creatineNotifications.length) {
            await this.saveCreatineNotifications(validCreatineNotifications);
         }

         // Clean up water notifications
         const waterIds = await this.getWaterNotificationIds();
         const validWaterIds = waterIds.filter((id) => scheduledIds.includes(id));
         if (validWaterIds.length !== waterIds.length) {
            await this.saveWaterNotificationIds(validWaterIds);
         }
      } catch (error) {
         console.error('Error cleaning up orphaned notifications:', error);
      }
   }

   static async initialize(): Promise<{ showReminderTimeModal: boolean }> {
      try {
         const hasPermission = await NotificationService.checkPermissions();
         if (!hasPermission) {
            const granted = await NotificationService.requestPermissions();
            if (granted) {
               return { showReminderTimeModal: true };
            }
            return { showReminderTimeModal: false };
         } else {
            await this.cleanupOrphanedNotifications();

            // if user's creatineReminderTIme is still null but we have permission, show the modal
            const creatineReminderTime = store.getState().settings.creatine_reminder_time;
            if (creatineReminderTime === null) {
               return { showReminderTimeModal: true };
            } else {
               // Maintain notifications on app startup
               await this.maintainCreatineNotifications(creatineReminderTime);
            }

            return { showReminderTimeModal: false };
         }
      } catch (error) {
         console.error('Error initializing notification service:', error);
         return { showReminderTimeModal: false };
      }
   }

   static async onCreatineGoalCompleted(): Promise<void> {
      try {
         const cancelled = await this.cancelTodaysCreatineNotification();
         if (cancelled) {
            console.log("successfully cancelled today's creatine reminder");
         }
      } catch (error) {
         console.error('Error handling creatine goal completion:', error);
      }
   }
}
