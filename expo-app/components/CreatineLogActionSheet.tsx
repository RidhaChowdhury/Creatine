import React, { useState, useEffect } from 'react';
import { Keyboard, Platform, View } from 'react-native';
import {
   Actionsheet,
   ActionsheetContent,
   ActionsheetDragIndicator,
   ActionsheetDragIndicatorWrapper,
   ActionsheetBackdrop,
   ActionsheetSectionHeaderText
} from '@/components/ui/actionsheet';
import { Button, ButtonText } from '@/components/ui/button';
import { VStack } from '@/components/ui/vstack';
import { HStack } from '@/components/ui/hstack';
import { Input, InputField } from '@/components/ui/input';
import {
   Select,
   SelectTrigger,
   SelectInput,
   SelectIcon,
   SelectPortal,
   SelectBackdrop,
   SelectContent,
   SelectDragIndicatorWrapper,
   SelectDragIndicator,
   SelectItem
} from '@/components/ui/select';
import { Text } from '@/components/ui/text';
import { ChevronDownIcon } from '@/components/ui/icon';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
   addCreatineLog,
   selectCreatineStatus,
   selectDailyCreatineTotal
} from '@/features/intake/intakeSlice';
import { selectCreatineGoal, selectSettingsStatus } from '@/features/settings/settingsSlice';
import { NotificationService } from '@/lib/notifications';

const CREATINE_FORMS = ['Monohydrate', 'HCL', 'Micronized'] as const;
type CreatineForm = (typeof CREATINE_FORMS)[number];

interface CreatineLogActionsheetProps {
   showActionsheet: boolean;
   handleClose: () => void;
}

export const CreatineLogActionsheet: React.FC<CreatineLogActionsheetProps> = ({
   showActionsheet,
   handleClose
}) => {
   const dispatch = useAppDispatch();

   const currentCreatineAmount = useAppSelector(selectDailyCreatineTotal);
   const creatineGoal = useAppSelector(selectCreatineGoal);
   const creatineStatus = useAppSelector(selectCreatineStatus);
   const settingsStatus = useAppSelector(selectSettingsStatus);

   const [grams, setGrams] = useState<string>('');
   const [form, setForm] = useState<CreatineForm>('Monohydrate');
   const [keyboardHeight, setKeyboardHeight] = useState(0);

   useEffect(() => {
      if (
         currentCreatineAmount >= creatineGoal &&
         creatineStatus === 'succeeded' &&
         settingsStatus === 'succeeded'
      ) {
         (async () => {
            await NotificationService.onCreatineGoalCompleted();
         })();
      }
      // here, we could also handle cases where a user deletes a creatine log that had previously met their goal
      // and canceled noti, but now puts them under goal... maybe we should reschedule?
   }, [currentCreatineAmount, creatineGoal, creatineStatus, settingsStatus]);

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

   return (
      <Actionsheet
         isOpen={showActionsheet}
         onClose={handleClose}>
         <ActionsheetBackdrop />
         <ActionsheetContent style={{ paddingBottom: keyboardHeight + 30 }}>
            <View style={{ width: '100%' }}>
               <ActionsheetDragIndicatorWrapper>
                  <ActionsheetDragIndicator />
               </ActionsheetDragIndicatorWrapper>

               <ActionsheetSectionHeaderText className='text-2xl'>
                  Creatine
               </ActionsheetSectionHeaderText>

               <VStack
                  className='w-full px-4'
                  space='md'>
                  <HStack
                     className='w-full'
                     space='md'>
                     {/* Amount Input */}
                     <View className='flex-1'>
                        <Text className='text-xs text-typography-300 mb-1'>Amount (grams)</Text>
                        <Input>
                           <InputField
                              value={grams}
                              onChangeText={setGrams}
                              placeholder='0.0'
                              keyboardType='decimal-pad'
                           />
                        </Input>
                     </View>

                     {/* Form Type Select */}
                     <View className='flex-1'>
                        <Text className='text-xs text-typography-500 mb-1'>Form Type</Text>
                        <Select
                           selectedValue={form}
                           onValueChange={(value: string) => setForm(value as CreatineForm)}>
                           <SelectTrigger
                              variant='outline'
                              size='md'
                              className='justify-between'>
                              <SelectInput placeholder='Select form' />
                              <SelectIcon
                                 as={ChevronDownIcon}
                                 className='mx-2'
                              />
                           </SelectTrigger>
                           <SelectPortal>
                              <SelectBackdrop />
                              <SelectContent style={{ paddingBottom: 30 }}>
                                 <SelectDragIndicatorWrapper>
                                    <SelectDragIndicator />
                                 </SelectDragIndicatorWrapper>
                                 {CREATINE_FORMS.map((option) => (
                                    <SelectItem
                                       key={option}
                                       label={option}
                                       value={option}
                                       className='rounded-xl'
                                    />
                                 ))}
                              </SelectContent>
                           </SelectPortal>
                        </Select>
                     </View>
                  </HStack>

                  {/* Log Button */}
                  <Button
                     size='lg'
                     variant='solid'
                     className={`w-full bg-primary-0 ${!grams ? 'opacity-70' : ''}`}
                     onPress={async () => {
                        if (grams) {
                           dispatch(addCreatineLog({ amount: Number(grams) }));
                           Keyboard.dismiss();
                           handleClose(); // Close the action sheet after logging
                        }
                     }}
                     isDisabled={!grams}>
                     <ButtonText className='font-medium text-white'>Log Creatine</ButtonText>
                  </Button>
               </VStack>
            </View>
         </ActionsheetContent>
      </Actionsheet>
   );
};
