import React, { useEffect, useState } from 'react';
import { Keyboard, Platform, View, TouchableOpacity } from 'react-native';
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
import DateTimePicker from '@react-native-community/datetimepicker';
import { ChevronDownIcon } from '@/components/ui/icon';
import { DRINK_TYPES } from '@/lib/constants';

type Mode = 'water' | 'creatine';

export type LogInitial = {
   id?: string;
   amount?: number;
   unit?: string;
   consumable?: string;
   consumed_at?: string;
};

interface Props {
   isOpen: boolean;
   mode: Mode;
   initial?: LogInitial; // if present, sheet is in edit mode
   onClose: () => void;
   onSubmit: (payload: {
      id?: string;
      amount: number;
      unit: string;
      consumable: string;
      consumed_at?: string;
   }) => void;
   onDelete?: (id: string) => void;
}

const LogActionSheet: React.FC<Props> = ({
   isOpen,
   mode,
   initial,
   onClose,
   onSubmit,
   onDelete
}) => {
   const [amount, setAmount] = useState<string>(initial?.amount?.toString() ?? '');
   const [type, setType] = useState<string>(
      initial?.consumable ?? (mode === 'water' ? 'water' : 'Monohydrate')
   );
   const [keyboardHeight, setKeyboardHeight] = useState(0);
   const [showPicker, setShowPicker] = useState<{ mode: 'date' | 'time'; visible: boolean }>({
      mode: 'time',
      visible: false
   });
   const [consumedAt, setConsumedAt] = useState<Date>(
      initial?.consumed_at ? new Date(initial.consumed_at) : new Date()
   );
   const [tempConsumedAt, setTempConsumedAt] = useState<Date | null>(null);

   useEffect(() => {
      setAmount(initial?.amount?.toString() ?? '');
      setType(initial?.consumable ?? (mode === 'water' ? 'water' : 'Monohydrate'));
      setConsumedAt(initial?.consumed_at ? new Date(initial.consumed_at as string) : new Date());
      setTempConsumedAt(null);
   }, [initial, mode, isOpen]);

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

   const submit = () => {
      const parsed = Number(amount || 0);
      const unit = mode === 'water' ? 'oz' : 'g';
      const consumable = mode === 'water' ? type : 'creatine';
      onSubmit({
         id: initial?.id,
         amount: parsed,
         unit,
         consumable,
         consumed_at: consumedAt.toISOString()
      });
      onClose();
   };

   const handleDelete = () => {
      if (initial?.id && onDelete) onDelete(initial.id);
      onClose();
   };

   const handleClose = () => {
      // close immediately, but cancel any temp date/time edits shortly after
      onClose();
      setTimeout(() => {
         setTempConsumedAt(null);
         setShowPicker((s) => ({ ...s, visible: false }));
      }, 250);
   };

   return (
      <Actionsheet
         isOpen={isOpen}
         onClose={handleClose}>
         <ActionsheetBackdrop />
         <ActionsheetContent style={{ paddingBottom: keyboardHeight + 30 }}>
            <View style={{ width: '100%' }}>
               <ActionsheetDragIndicatorWrapper>
                  <ActionsheetDragIndicator />
               </ActionsheetDragIndicatorWrapper>

               <ActionsheetSectionHeaderText className='text-2xl'>
                  {mode === 'water' ? 'Water' : 'Creatine'}
               </ActionsheetSectionHeaderText>

               <VStack
                  className='w-full px-4'
                  space='md'>
                  <View className='flex-row justify-between items-center'>
                     <TouchableOpacity
                        onPress={() => {
                           setTempConsumedAt(consumedAt);
                           setShowPicker({ mode: 'date', visible: true });
                        }}>
                        <Text className='text-sm'>
                           Date:{' '}
                           {consumedAt.toLocaleDateString(undefined, {
                              month: 'long',
                              day: 'numeric',
                              year: 'numeric'
                           })}
                        </Text>
                     </TouchableOpacity>
                     <TouchableOpacity
                        onPress={() => {
                           setTempConsumedAt(consumedAt);
                           setShowPicker({ mode: 'time', visible: true });
                        }}>
                        <Text className='text-sm'>
                           Time:{' '}
                           {consumedAt.toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                           })}
                        </Text>
                     </TouchableOpacity>
                  </View>
                  {showPicker.visible && (
                     <>
                        <DateTimePicker
                           value={tempConsumedAt ?? consumedAt}
                           mode={showPicker.mode}
                           is24Hour={false}
                           display='spinner'
                           onChange={(e, d) => {
                              if (d) setTempConsumedAt(d);
                           }}
                        />

                        <View className='w-full flex-col gap-2'>
                           <Button
                              size='md'
                              variant='outline'
                              className='w-full'
                              onPress={() => {
                                 // cancel - discard temp
                                 setTempConsumedAt(null);
                                 setShowPicker((s) => ({ ...s, visible: false }));
                              }}>
                              <ButtonText>Cancel</ButtonText>
                           </Button>

                           <Button
                              size='md'
                              variant='solid'
                              className='w-full'
                              onPress={() => {
                                 // confirm
                                 if (tempConsumedAt) setConsumedAt(tempConsumedAt);
                                 setTempConsumedAt(null);
                                 setShowPicker((s) => ({ ...s, visible: false }));
                              }}>
                              <ButtonText>Confirm</ButtonText>
                           </Button>
                        </View>
                     </>
                  )}
                  {!showPicker.visible && (
                     <>
                        <HStack
                           className='w-full'
                           space='md'>
                           <View style={{ flex: 1 }}>
                              <Text className='text-xs text-typography-300 mb-1'>
                                 {mode === 'water' ? 'Amount (oz)' : 'Amount (grams)'}
                              </Text>
                              <Input>
                                 <InputField
                                    value={amount}
                                    onChangeText={setAmount}
                                    placeholder='0'
                                    keyboardType='numeric'
                                 />
                              </Input>
                           </View>

                           <View style={{ flex: 1 }}>
                              <Text className='text-xs text-typography-500 mb-1'>
                                 {mode === 'water' ? 'Drink Type' : 'Form'}
                              </Text>
                              {mode === 'water' ? (
                                 <Select
                                    selectedValue={type}
                                    onValueChange={(v: string) => setType(v)}>
                                    <SelectTrigger
                                       variant='outline'
                                       size='md'
                                       className='justify-between'>
                                       <SelectInput placeholder='Select drink' />
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
                                          {DRINK_TYPES.map((option) => (
                                             <SelectItem
                                                key={option}
                                                label={option}
                                                value={option}
                                             />
                                          ))}
                                       </SelectContent>
                                    </SelectPortal>
                                 </Select>
                              ) : (
                                 <Select
                                    selectedValue={type}
                                    onValueChange={(v: string) => setType(v)}>
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
                                          <SelectItem
                                             label='Monohydrate'
                                             value='Monohydrate'
                                          />
                                          <SelectItem
                                             label='HCL'
                                             value='HCL'
                                          />
                                          <SelectItem
                                             label='Micronized'
                                             value='Micronized'
                                          />
                                       </SelectContent>
                                    </SelectPortal>
                                 </Select>
                              )}
                           </View>
                        </HStack>

                        <Button
                           size='lg'
                           variant='solid'
                           className={`w-full bg-primary-0 ${!amount ? 'opacity-70' : ''}`}
                           onPress={submit}
                           isDisabled={!amount}>
                           <ButtonText className='font-medium text-white'>
                              {initial ? 'Save' : 'Log'}
                           </ButtonText>
                        </Button>

                        {initial?.id && onDelete && (
                           <Button
                              size='lg'
                              variant='solid'
                              className='w-full bg-red-700'
                              onPress={handleDelete}>
                              <ButtonText className='font-medium'>Delete</ButtonText>
                           </Button>
                        )}
                     </>
                  )}
               </VStack>
            </View>
         </ActionsheetContent>
      </Actionsheet>
   );
};

export default LogActionSheet;
