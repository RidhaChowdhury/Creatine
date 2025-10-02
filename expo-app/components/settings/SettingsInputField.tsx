import { View, Text, TextInput } from 'react-native';
import React, { useState } from 'react';

type SettingsInputFieldProps = {
   label: string;
   bottomSeperator?: boolean;
};

const SettingsInputField = ({ label, bottomSeperator }: SettingsInputFieldProps) => {
   const [currentText, onChangeText] = useState('');

   return (
      <View
         className={`flex-row items-center justify-between px-4 py-3 mb-0 h-[65px] ${
            bottomSeperator ? 'border-b border-neutral-800 ' : ''
         }`}>
         <View className='flex-row items-center'>
            <Text className='ml-3 text-white text-[18px]'>{label}</Text>
            <TextInput
               onChangeText={onChangeText}
               value={currentText}
               placeholder={label}
               className='text-white text-[18px] ml-16'
               keyboardType='default'></TextInput>
         </View>
      </View>
   );
};

export default SettingsInputField;
