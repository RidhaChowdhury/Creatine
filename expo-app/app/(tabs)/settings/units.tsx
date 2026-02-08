import { View, Text, SafeAreaView, Button, ScrollView } from 'react-native';
import React, { useLayoutEffect, useState } from 'react';
import { useNavigation } from 'expo-router';
import UnitPicker from '@/components/settings/UnitPicker';

const units = () => {
   const [isDirty, setIsDirty] = useState(false);

   const updateUnits = () => {};

   const navigation = useNavigation();
   useLayoutEffect(() => {
      navigation.setOptions({
         headerRight: () => (
            <Button
               title='Save'
               disabled={!isDirty}
               onPress={updateUnits}
            />
         )
      });
   });

   return (
      <SafeAreaView className='bg-background-0 h-full'>
         <ScrollView
            showsVerticalScrollIndicator={false}
            className='px-8'
            contentContainerClassName='flex-grow'>
            <Text className='text-xl font-semibold text-white mt-2 mb-2'>Drink Unit</Text>
            <UnitPicker
               unitOne='ml'
               unitTwo='oz'
            />
            <Text className='text-xl font-semibold text-white mt-8 mb-2'>Supplement Unit</Text>
            <UnitPicker
               unitOne='g'
               unitTwo='mg'
            />
         </ScrollView>
      </SafeAreaView>
   );
};

export default units;
