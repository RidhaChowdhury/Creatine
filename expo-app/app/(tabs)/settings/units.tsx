import { View, Text, SafeAreaView, Button } from 'react-native';
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
         <UnitPicker />
      </SafeAreaView>
   );
};

export default units;
