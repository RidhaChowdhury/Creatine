import { View, SafeAreaView, TouchableOpacity, ScrollView } from 'react-native';
import React from 'react';
import { supabase } from '@/lib/supabase';
import { Text } from '@/components/ui/text/';
import {
   User,
   Lock,
   Bell,
   Ruler,
   CircleFadingArrowUpIcon,
   Droplet,
   Inbox
} from 'lucide-react-native'; // lucide icons
import { selectUserSettings } from '@/features/settings/settingsSlice';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectUser, setUser } from '@/features/auth/authSlice';
import { updateSettings } from '@/features/settings/settingsSlice';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { router } from 'expo-router';

const Settings = () => {
   const dispatch = useAppDispatch();
   const user = useAppSelector(selectUser);
   const settings = useAppSelector(selectUserSettings);
   const [formState, setFormState] = React.useState({});
   const [activeEditSection, setActiveEditSection] = React.useState<string | null>(null);

   const toggleEdit = (section: string) => {
      setActiveEditSection((prev) => (prev === section ? null : section));
   };

   const handleInputChange = (field: string, value: string) => {
      setFormState((prev) => ({
         ...prev,
         [field]: value
      }));
   };

   const handleSave = () => {
      dispatch(updateSettings({ formData: { ...settings, ...formState } }));
      toggleEdit(activeEditSection!);
   };

   return (
      <SafeAreaView className='bg-background-0 h-full'>
         <ScrollView
            showsVerticalScrollIndicator={false}
            className='px-4'
            contentContainerClassName='flex-grow'>
            {/* Account Section */}
            <Text className='text-xl font-semibold text-white px-2 mt-2 mb-2'>Account</Text>

            <SettingsRow
               label='Profile'
               Icon={User}
               onPress={() => router.push('/settings/profile') }
            />
            <SettingsRow
               label='Account'
               Icon={Lock}
               onPress={() => router.push('/settings/account')}
            />
            <SettingsRow
               label='Manage Subscription'
               Icon={CircleFadingArrowUpIcon}
               onPress={() => router.push('/settings/manageSubscription')}
            />

            {/* Preferences Section */}
            <Text className='text-xl font-semibold text-white px-2 mt-2 mb-2'>Preferences</Text>

            <SettingsRow
               label='Units'
               Icon={Ruler}
               onPress={() => router.push('/settings/units')}
            />
            <SettingsRow
               label='Notifications'
               Icon={Bell}
               onPress={() => router.push('/settings/notifications')}
            />

            {/* Help Section */}
            <Text className='text-xl font-semibold text-white px-2 mt-2 mb-2'>Help</Text>
            <SettingsRow
               label='About'
               Icon={Droplet}
               onPress={() => router.push('/settings/about')}
            />
            <SettingsRow
               label='Contact Us'
               Icon={Inbox}
               onPress={() => router.push('/settings/about')}
            />

            <View className='flex-1 justify-end'>
               <TouchableOpacity
                  className='justify-center items-center bg-red-900 rounded-lg px-4 py-3 mb-4 h-[45px]'
                  onPress={() => supabase.auth.signOut()}>
                  <Text className='text-white text-[18px] font-semibold'>Log Out</Text>
               </TouchableOpacity>
            </View>
         </ScrollView>
      </SafeAreaView>
   );
};

export default Settings;
