import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const STORAGE_KEYS = {
   CREATINE_NOTIFICATION_ID: 'creatine_notification_id',
   WATER_NOTIFICATION_IDS: 'water_notification_ids'
   // NOTIFICATION_PREFERENCES: 'notification_preferences',
} as const;

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

   // AsyncStorage helpers //

   static async saveCreatineNotificationId(id: string): Promise<void> {
      try {
         await AsyncStorage.setItem(STORAGE_KEYS.CREATINE_NOTIFICATION_ID, id);
      } catch (error) {
         console.error('Error saving creatine notification id to async storage');
      }
   }

   static async getCreatineNotificationId(): Promise<string | null> {
      try {
         return await AsyncStorage.getItem(STORAGE_KEYS.CREATINE_NOTIFICATION_ID);
      } catch (error) {
         console.error('Error getting creatine notification id from async storage');
         return null;
      }
   }

   static async clearCreatineNotificationId(): Promise<void> {
      try {
         await AsyncStorage.removeItem(STORAGE_KEYS.CREATINE_NOTIFICATION_ID);
      } catch (error) {
         console.error('Error removing creatine notification from async storage');
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

   // actually cancelling the notifications + calling AsyncStorage helpers //

   static async cancelCreatineReminder(): Promise<void> {
      try {
         const id = await this.getCreatineNotificationId();

         if (id) {
            await Notifications.cancelScheduledNotificationAsync(id);
            await this.clearCreatineNotificationId();
         }
      } catch (error) {
         console.error('Error cancelling creatine reminder:', error);
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

   // scheduling reminders //

   static async scheduleCreatineReminder(time?: string): Promise<void> {
      try {
         const hasPermission = await this.checkPermissions();
         if (!hasPermission) {
            console.log('No notification permission for creatine reminder');
            return;
         }

         const reminderTime = time || '23:05';

         await this.cancelCreatineReminder();

         console.log('hello fellas');

         const [hours, minutes] = reminderTime.split(':').map(Number);
         const scheduledDate = new Date();
         scheduledDate.setHours(hours, minutes, 0, 0);

         console.log('hour: ', scheduledDate.getHours());
         console.log('mins: ', scheduledDate.getMinutes());

         const id = await Notifications.scheduleNotificationAsync({
            content: {
               title: '💪 Creatine Time!',
               body: 'Time for your daily creatine supplement'
            },
            trigger: {
               type: Notifications.SchedulableTriggerInputTypes.DAILY,
               hour: scheduledDate.getHours(),
               minute: scheduledDate.getMinutes()
            }
         });

         await this.saveCreatineNotificationId(id);
      } catch (error) {
         console.error('Error scheduling creatine reminder:', error);
      }
   }

   static async scheduleWaterReminders(customIntervals?: number[]): Promise<void> {
      try {
         const hasPermission = await this.checkPermissions();
         if (!hasPermission) {
            console.log('No notification permission for water reminders');
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

   // initialization functions //

   static async cleanupOrphanedNotifications(): Promise<void> {
      try {
         const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
         const scheduledIds = scheduledNotifications.map((n) => n.identifier);

         const creatineId = await this.getCreatineNotificationId();
         if (creatineId && !scheduledIds.includes(creatineId)) {
            await this.clearCreatineNotificationId();
         }

         const waterIds = await this.getWaterNotificationIds();
         const validWaterIds = waterIds.filter((id) => scheduledIds.includes(id));
         if (validWaterIds.length !== waterIds.length) {
            await this.saveWaterNotificationIds(validWaterIds);
         }
      } catch (error) {
         console.error('Error cleaning up orphaned notifications:', error);
      }
   }

   static async initialize(): Promise<void> {
      try {
         const hasPermission = await NotificationService.checkPermissions();
         if (!hasPermission) {
            const granted = await NotificationService.requestPermissions();
            if (granted) {
               // possibly make them setup creatine time here in future
               console.log('about to schedule a creatine reminder');
               await this.scheduleCreatineReminder();
            }
         } else {
            // Clean up any orphaned notifications (IDs stored but notification doesn't exist)
            await this.cleanupOrphanedNotifications();
         }
      } catch (error) {
         console.error('Error initializing notification service:', error);
      }
   }
}
