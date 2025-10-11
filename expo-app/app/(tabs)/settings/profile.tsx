import {
   View,
   Text,
   SafeAreaView,
   TextInput,
   TouchableOpacity,
   ScrollView,
   Button
} from 'react-native';
import React, { useLayoutEffect, useState } from 'react';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { User } from 'lucide-react-native';
import { router } from 'expo-router';
import SettingsInputField from '@/components/settings/SettingsInputField';
import { useAppSelector } from '@/store/hooks';
import { selectProfileSettings } from '@/features/settings/settingsSlice';
import { useNavigation } from 'expo-router';

const profile = () => {
   const profileSettings = useAppSelector(selectProfileSettings);
   const [name, setName] = useState(profileSettings.name);
   const [height, setHeight] = useState(profileSettings.height);
   const [weight, setWeight] = useState(profileSettings.weight);
   const [isDirty, setIsDirty] = useState(false);

   const onChangeText = <K extends keyof typeof profileSettings>(
      setFunction: React.Dispatch<React.SetStateAction<string>>,
      text: string,
      field: K
   ) => {
      setFunction(text);
      setIsDirty(profileSettings[field] != text);
   };

   const updateProfile = () => {
      router.replace('/(tabs)/settings');
   };

   const navigation = useNavigation();
   useLayoutEffect(() => {
      navigation.setOptions({
         headerRight: () => (
            <Button
               title='Save'
               disabled={!isDirty}
               onPress={updateProfile}
            />
         )
      });
   }, [isDirty]);

   return (
      <SafeAreaView className='bg-background-0 h-full'>
         <ScrollView
            showsVerticalScrollIndicator={false}
            className='px-4'
            contentContainerClassName='flex-grow'>
            <SettingsInputField
               label='Name'
               field='name'
               bottomSeperator
               value={name}
               setFunction={setName}
               onChangeText={onChangeText}
            />
            <SettingsInputField
               label='Height'
               field='height'
               bottomSeperator
               value={height.toString()}
               setFunction={setHeight}
               onChangeText={onChangeText}
               keyboardType='numeric'
            />
            <SettingsInputField
               label='Weight'
               field='weight'
               bottomSeperator
               value={weight.toString()}
               setFunction={setWeight}
               onChangeText={onChangeText}
            />
         </ScrollView>
      </SafeAreaView>
   );
};

export default profile;
