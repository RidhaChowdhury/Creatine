import { View, TouchableOpacity, Platform, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useEffect, useState } from 'react';
import { Text } from '@/components/ui/text';
import { Input, InputField } from '@/components/ui/input';
import {
   AlertDialog,
   AlertDialogContent,
   AlertDialogHeader,
   AlertDialogFooter,
   AlertDialogBody,
   AlertDialogBackdrop
} from '@/components/ui/alert-dialog';
import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import {
   Select,
   SelectBackdrop,
   SelectContent,
   SelectDragIndicator,
   SelectDragIndicatorWrapper,
   SelectIcon,
   SelectInput,
   SelectItem,
   SelectPortal,
   SelectTrigger
} from '@/components/ui/select';
import { ChevronDownIcon } from '@/components/ui/icon';
import { router } from 'expo-router';
import { useAppDispatch } from '@/store/hooks';
import { addSettings } from '@/features/settings/settingsSlice';

const Onboarding = () => {
   const [showAlertDialog, setShowAlertDialog] = React.useState(false);
   const handleClose = () => setShowAlertDialog(false);

   const dispatch = useAppDispatch();

   const [formData, setFormData] = React.useState({
      name: '',
      height: 0,
      weight: 0,
      sex: ''
   });

   const [isNameInvalid, setIsNameInvalid] = React.useState(false);
   const [isHeightInvalid, setIsHeightInvalid] = React.useState(false);
   const [isWeightInvalid, setIsWeightInvalid] = React.useState(false);
   const [isSexInvalid, setIsSexInvalid] = React.useState(false);

   const [keyboardHeight, setKeyboardHeight] = useState(0);

   useEffect(() => {
      const showSubscription = Keyboard.addListener(
         Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
         (e) => setKeyboardHeight(e.endCoordinates.height)
      );
      const hideSubscription = Keyboard.addListener(
         Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
         () => setKeyboardHeight(0)
      );

      return () => {
         showSubscription.remove();
         hideSubscription.remove();
      };
   }, []);

   const handleSubmit = () => {
      // input validation
      if (formData.name == '') {
         setIsNameInvalid(true);
         return;
      } else {
         setIsNameInvalid(false);
      }
      if (!formData.height) {
         setIsHeightInvalid(true);
         return;
      } else {
         setIsHeightInvalid(false);
      }
      if (!formData.weight) {
         setIsWeightInvalid(true);
         return;
      } else {
         setIsWeightInvalid(false);
      }
      if (formData.sex == '') {
         setIsSexInvalid(true);
         return;
      } else {
         setIsSexInvalid(false);
      }

      dispatch(addSettings({ formData: formData }));

      router.replace('/(tabs)');
   };

   return (
      <SafeAreaView className='bg-background-0 h-full'>
         <View
            className='flex-1 justify-center mt-[-20%] p-[30]'
            style={{ paddingBottom: keyboardHeight - 120 }}>
            <Text className='text-[30px] font-bold'>Welcome aboard!</Text>
            <Text className='text-[14px] mt-2'>
               Let's get started by filling in some more details.
            </Text>
            <Text className='text-[14px] font-semibold pt-[25] pb-[10]'>What's your name?</Text>
            <Input
               className='h-[45]'
               isRequired={true}
               isInvalid={isNameInvalid}>
               <InputField
                  placeholder='Sammy'
                  onChangeText={(e: string) =>
                     setFormData((prev) => ({ ...prev, name: e }))
                  }></InputField>
            </Input>
            <View className='flex-row items-center justify-between'>
               <Text className='text-[14px] font-semibold pt-[25] pb-[10]'>
                  What's your height (in inches)?
               </Text>
            </View>
            <Input
               className='h-[45]'
               isRequired={true}
               isInvalid={isHeightInvalid}>
               <InputField
                  placeholder='72'
                  onChangeText={(e: string) =>
                     setFormData((prev) => ({ ...prev, height: Number(e) }))
                  }></InputField>
            </Input>
            <View className='flex-row items-center justify-between'>
               <Text className='text-[14px] font-semibold pt-[25] pb-[10]'>
                  What's your weight (lbs)?
               </Text>

               <AlertDialog
                  isOpen={showAlertDialog}
                  onClose={handleClose}
                  size='md'>
                  <AlertDialogBackdrop />
                  <AlertDialogContent>
                     <AlertDialogHeader>
                        <Heading
                           className='text-typography-950 font-semibold'
                           size='md'>
                           Why do we need your height, weight, and sex?
                        </Heading>
                     </AlertDialogHeader>
                     <AlertDialogBody className='mt-3 mb-4'>
                        <Text size='sm'>
                           We ask for your height, weight, and sex to provide more accurate
                           hydration and creatine intake recommendations tailored to your body.
                           These factors help us estimate your daily needs, so you get the right
                           balance for optimal performance and well-being.
                        </Text>
                     </AlertDialogBody>
                     <AlertDialogFooter className=''>
                        <Button
                           size='sm'
                           onPress={handleClose}>
                           <ButtonText>Okay!</ButtonText>
                        </Button>
                     </AlertDialogFooter>
                  </AlertDialogContent>
               </AlertDialog>
            </View>
            <Input
               className='h-[45]'
               isRequired={true}
               isInvalid={isWeightInvalid}>
               <InputField
                  placeholder='200'
                  onChangeText={(e: string) =>
                     setFormData((prev) => ({ ...prev, weight: Number(e) }))
                  }></InputField>
            </Input>

            <Text className='text-[14px] font-semibold pt-[25] pb-[10]'>What's your sex?</Text>
            <Select
               isRequired={true}
               isInvalid={isSexInvalid}
               onValueChange={(value: string) => setFormData((prev) => ({ ...prev, sex: value }))}>
               <SelectTrigger
                  variant='outline'
                  size='md'
                  className='justify-between h-[45]'>
                  <SelectInput placeholder={''} />
                  <SelectIcon
                     className='mr-3'
                     as={ChevronDownIcon}
                  />
               </SelectTrigger>
               <SelectPortal>
                  <SelectBackdrop />
                  <SelectContent>
                     <SelectDragIndicatorWrapper>
                        <SelectDragIndicator />
                     </SelectDragIndicatorWrapper>
                     <SelectItem
                        label='Male'
                        value='male'
                     />
                     <SelectItem
                        label='Female'
                        value='female'
                     />
                  </SelectContent>
               </SelectPortal>
            </Select>
            <TouchableOpacity
               className='flex flex-row justify-end mt-2'
               onPress={() => setShowAlertDialog(true)}>
               <Text className='text-[12px]'>Why do we need this?</Text>
            </TouchableOpacity>
            <Button
               className='mt-[20] h-[45]'
               onPress={() => handleSubmit()}>
               <ButtonText className='text-[20px]'>Take me to the app!</ButtonText>
            </Button>
         </View>
      </SafeAreaView>
   );
};

export default Onboarding;
