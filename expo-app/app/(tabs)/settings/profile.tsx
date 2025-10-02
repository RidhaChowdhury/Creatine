import { View, Text, SafeAreaView, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import React from 'react';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { User } from 'lucide-react-native';
import { router } from 'expo-router';
import SettingsInputField from '@/components/settings/SettingsInputField';

const profile = () => {
   return (
      <SafeAreaView className='bg-background-0 h-full'>
         <ScrollView
            showsVerticalScrollIndicator={false}
            className='px-4'
            contentContainerClassName='flex-grow'>
            <SettingsInputField
               label='Name'
               bottomSeperator
            />
         </ScrollView>
      </SafeAreaView>
   );
};

export default profile;
