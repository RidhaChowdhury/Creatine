import React from 'react';
import { TouchableOpacity, Text, View } from 'react-native';
import { LucideIcon, ChevronRight } from 'lucide-react-native';

type SettingsRowProps = {
   label: string;
   Icon: LucideIcon;
   onPress?: () => void;
   bottomSeperator?: boolean;
};

export function SettingsRow({ label, Icon, onPress, bottomSeperator }: SettingsRowProps) {
   return (
      <TouchableOpacity
         onPress={onPress}
         className={`flex-row items-center justify-between px-4 py-3 mb-0 h-[65px] ${
            bottomSeperator ? 'border-b border-neutral-800 ' : ''
         }`}>
         <View className='flex-row items-center'>
            <Icon
               size={20}
               color='white'
            />
            <Text className='ml-3 text-white text-[18px]'>{label}</Text>
         </View>

         <ChevronRight
            size={20}
            color='white'
         />
      </TouchableOpacity>
   );
}
