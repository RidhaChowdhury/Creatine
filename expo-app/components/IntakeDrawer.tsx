import React from 'react';
import { View, Keyboard, Platform, Dimensions, ScrollView, TextInput } from 'react-native';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { Button, ButtonText } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import {
   Actionsheet,
   ActionsheetBackdrop,
   ActionsheetContent,
   ActionsheetDragIndicator,
   ActionsheetDragIndicatorWrapper,
   ActionsheetScrollView
} from '@/components/ui/actionsheet';
import DateTimePicker from '@react-native-community/datetimepicker';
import { selectDrinkUnit } from '@/features/settings/settingsSlice';
import {
   addDrinkLog,
   addCreatineLog,
   updateIntakeLog,
   deleteIntakeLog
} from '@/features/intake/intakeSlice';
import { CalendarClock, Minus, Plus, Trash, Check } from 'lucide-react-native';
import { Checkbox, CheckboxIndicator, CheckboxLabel, CheckboxIcon } from '@/components/ui/checkbox';

type Props = {
   isOpen: boolean;
   onClose: () => void;
   /** If present, drawer is in edit mode for that intake log */
   initial?: {
      id?: string;
      amount?: number;
      unit?: string;
      consumable?: string; // 'water' or 'creatine' or other drink
      consumed_at?: string;
   };
   quickAmounts?: number[]; // quick-add water amounts (in current drink unit)
};

const defaultQuick = [8, 12, 16, 20, 24, 32];

// Ensure DB-friendly datetime format (YYYY-MM-DD HH:mm:ss)
const toSqlDateTime = (d: Date) => {
   const yyyy = d.getFullYear();
   const mm = String(d.getMonth() + 1).padStart(2, '0');
   const dd = String(d.getDate()).padStart(2, '0');
   const hh = String(d.getHours()).padStart(2, '0');
   const mi = String(d.getMinutes()).padStart(2, '0');
   const ss = String(d.getSeconds()).padStart(2, '0');
   return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
};

const IntakeDrawer: React.FC<Props> = ({ isOpen, onClose, initial, quickAmounts }) => {
   const dispatch = useAppDispatch();
   const drinkUnit = useAppSelector(selectDrinkUnit);

   const isEditing = Boolean(initial?.id);

   const [waterAmount, setWaterAmount] = React.useState<number>(initial?.amount ?? 0);
   const [includeCreatine, setIncludeCreatine] = React.useState<boolean>(false);
   const [pickerState, setPickerState] = React.useState<{ mode: 'date' | 'time' | null }>({
      mode: null
   });
   const [consumedAt, setConsumedAt] = React.useState<Date>(
      initial?.consumed_at ? new Date(initial.consumed_at) : new Date()
   );
   const [keyboardHeight, setKeyboardHeight] = React.useState(0);
   const [isAmountFocused, setIsAmountFocused] = React.useState(false);
   const [waterAmountText, setWaterAmountText] = React.useState<string>(
      initial?.amount !== undefined ? String(initial.amount) : '0'
   );
   const [quicksLocal, setQuicksLocal] = React.useState<number[]>([]);
   const [quickEdit, setQuickEdit] = React.useState<{ active: boolean; index: number | null }>({
      active: false,
      index: null
   });
   const [quickEditValue, setQuickEditValue] = React.useState<number>(0);
   const [quickEditText, setQuickEditText] = React.useState<string>('0');
   const cancelQuick = () => {
      setQuickEdit({ active: false, index: null });
      setIsAmountFocused(false);
   };

   // Close handler: reset quick-edit state when the sheet closes
   const handleClose = React.useCallback(() => {
      setQuickEdit({ active: false, index: null });
      setIsAmountFocused(false);
      setPickerState({ mode: null });
      setIncludeCreatine(false);
      setWaterAmount(0);
      setWaterAmountText('0');
      onClose();
   }, [onClose]);

   // If parent closes the sheet by changing isOpen, ensure quick-edit state is cleared
   React.useEffect(() => {
      if (!isOpen) {
         setQuickEdit({ active: false, index: null });
         setIsAmountFocused(false);
         setPickerState({ mode: null });
         setIncludeCreatine(false);
      }
   }, [isOpen]);

   React.useEffect(() => {
      const showSub = Keyboard.addListener(
         Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
         (e) => setKeyboardHeight(e.endCoordinates.height)
      );
      const hideSub = Keyboard.addListener(
         Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
         () => setKeyboardHeight(0)
      );
      return () => {
         showSub.remove();
         hideSub.remove();
      };
   }, []);

   React.useEffect(() => {
      setWaterAmount(initial?.amount ?? 0);
      setConsumedAt(initial?.consumed_at ? new Date(initial.consumed_at) : new Date());
      // sync text when external initial changes
      setWaterAmountText(initial?.amount !== undefined ? String(initial.amount) : '0');
   }, [initial, isOpen]);

   React.useEffect(() => {
      // keep the text buffer in sync when amount changes externally and input not focused
      if (!isAmountFocused) setWaterAmountText(String(waterAmount));
   }, [waterAmount, isAmountFocused]);

   // Seed local quicks from props/defaults when unit or provided list changes
   React.useEffect(() => {
      const base = quickAmounts ?? (drinkUnit === 'ml' ? [250, 330, 500, 750] : defaultQuick);
      setQuicksLocal(base);
   }, [drinkUnit, quickAmounts]);

   const adjustAmount = (delta: number) => {
      if (quickEdit.active) {
         setQuickEditValue((prev) => Math.max(0, Math.round((prev + delta) * 100) / 100));
         setQuickEditText((prev) => {
            const parsed = Number(prev.replace(',', '.'));
            const next = (Number.isNaN(parsed) ? 0 : parsed) + delta;
            return String(Math.max(0, Math.round(next * 100) / 100));
         });
      } else {
         setWaterAmount((prev) => Math.max(0, Math.round((prev + delta) * 100) / 100));
      }
   };

   const handleQuick = (val: number) => setWaterAmount(val);

   // Quick add customization helpers
   const startAddQuick = () => {
      const initialVal = waterAmount > 0 ? waterAmount : drinkUnit === 'ml' ? 250 : 8;
      setQuickEdit({ active: true, index: null });
      setQuickEditValue(initialVal);
      setQuickEditText(String(initialVal));
      setIsAmountFocused(true);
      setPickerState({ mode: null });
   };

   const startEditQuick = (index: number) => {
      const val = quicksLocal[index];
      setQuickEdit({ active: true, index });
      setQuickEditValue(val);
      setQuickEditText(String(val));
      setIsAmountFocused(true);
      setPickerState({ mode: null });
   };

   const saveQuick = () => {
      const v = Math.max(0, Math.round(quickEditValue * 100) / 100);
      if (quickEdit.index === null) {
         setQuicksLocal((prev) => {
            if (prev.includes(v)) return prev;
            return [...prev, v].sort((a, b) => a - b);
         });
      } else {
         setQuicksLocal((prev) => {
            const next = [...prev];
            next[quickEdit.index!] = v;
            return Array.from(new Set(next)).sort((a, b) => a - b);
         });
      }
      setQuickEdit({ active: false, index: null });
      setIsAmountFocused(false);
   };

   const deleteQuick = () => {
      if (quickEdit.index !== null) {
         setQuicksLocal((prev) => prev.filter((_, i) => i !== quickEdit.index));
      }
      setQuickEdit({ active: false, index: null });
      setIsAmountFocused(false);
   };

   const handleConfirm = async () => {
      const when = toSqlDateTime(consumedAt);
      if (isEditing && initial?.id) {
         // Update existing entry (amount, maybe unit, and consumed_at)
         await dispatch(
            updateIntakeLog({
               id: initial.id,
               amount: waterAmount,
               unit: initial.unit,
               consumed_at: when
            })
         );
      } else {
         // Add water only if > 0
         if (waterAmount > 0) {
            await dispatch(
               addDrinkLog({
                  amount: waterAmount,
                  consumable: 'water' as any,
                  unit: drinkUnit,
                  consumed_at: when
               })
            );
         }
         // Optional creatine pair (5g)
         if (includeCreatine) {
            await dispatch(addCreatineLog({ amount: 5, unit: 'g', consumed_at: when }));
         }
      }
      onClose();
   };

   const handleDelete = async () => {
      if (initial?.id) {
         await dispatch(deleteIntakeLog(initial.id));
         onClose();
      }
   };

   // Determine display unit and quick amounts (water-centric)
   const displayUnit = isEditing ? (initial?.unit ?? drinkUnit) : drinkUnit;
   const waterDefaults = drinkUnit === 'ml' ? [250, 330, 500, 750] : defaultQuick;
   const quicks = quicksLocal;

   return (
   <Actionsheet
      isOpen={isOpen}
      onClose={handleClose}>
         <ActionsheetBackdrop />
         <ActionsheetContent style={{ paddingBottom: keyboardHeight + 30, width: '100%' }}>
            <View className='w-full'>
               <ActionsheetDragIndicatorWrapper>
                  <ActionsheetDragIndicator />
               </ActionsheetDragIndicatorWrapper>
            </View>
            <ActionsheetScrollView className='w-full'>
               {/* Water Input with +/- at edges */}
               <View className='flex-row items-center justify-between'>
                  <Button
                     variant='outline'
                     size='lg'
                     onPress={() => adjustAmount(-1)}
                     className='w-16 h-16 rounded-full'>
                     <Minus color={'white'} />
                  </Button>
                  <View className='flex flex-col items-center'>
                     <TextInput
                        value={quickEdit.active ? quickEditText : waterAmountText}
                        onChangeText={(t) => {
                           if (quickEdit.active) {
                              setQuickEditText(t);
                              const parsed = Number(t.replace(',', '.'));
                              if (!Number.isNaN(parsed)) setQuickEditValue(parsed);
                           } else {
                              setWaterAmountText(t);
                              const parsed = Number(t.replace(',', '.'));
                              if (!Number.isNaN(parsed)) setWaterAmount(parsed);
                           }
                        }}
                        onFocus={() => {
                           setIsAmountFocused(true);
                           // hide pickers and related controls while editing
                           setPickerState({ mode: null });
                        }}
                        onBlur={() => setIsAmountFocused(false)}
                        keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
                        returnKeyType='done'
                        className='text-[5rem] font-extrabold text-center'
                        style={{ includeFontPadding: false, color: '#ffffff' }}
                     />
                     <Text className='text-typography-500'>OUNCES</Text>
                  </View>
                  <Button
                     variant='outline'
                     size='lg'
                     onPress={() => adjustAmount(1)}
                     className='w-16 h-16 rounded-full'>
                     <Plus color={'white'} />
                  </Button>
               </View>

               <View className='mt-3 flex flex-col gap-2'>
                  {/* Quick adds row with always-visible plus button (hidden in quick-edit mode) */}
                  {!quickEdit.active && (
                     <View className='flex-row items-center'>
                        <ScrollView
                           horizontal
                           showsHorizontalScrollIndicator={false}
                           className='flex-1'>
                           {quicks.map((q, idx) => (
                              <View
                                 key={`${q}-${idx}`}
                                 style={{ marginRight: 8 }}>
                                 <Button
                                    size='lg'
                                    variant='outline'
                                    onPress={() => handleQuick(q)}
                                    onLongPress={() => startEditQuick(idx)}
                                    className='px-4'>
                                    <ButtonText>{q} oz</ButtonText>
                                 </Button>
                              </View>
                           ))}
                        </ScrollView>
                        <Button
                           size='lg'
                           variant='outline'
                           onPress={startAddQuick}
                           className='px-4'>
                           <ButtonText>+</ButtonText>
                        </Button>
                     </View>
                  )}

                  {/* Date & Time selectors */}
                  {!isAmountFocused && !quickEdit.active && (
                     <View className='flex-row gap-1 items-center justify-between'>
                        <Checkbox
                           size='md'
                           value='creatine'
                           isChecked={includeCreatine}
                           onPress={() => setIncludeCreatine((v) => !v)}>
                           <CheckboxIndicator>
                              <CheckboxIcon as={Check} />
                           </CheckboxIndicator>
                           <CheckboxLabel className='text-sm'>5g Creatine</CheckboxLabel>
                        </Checkbox>
                        <View className='flex-row gap-1 items-center'>
                           <CalendarClock color={'white'} />
                           <Button
                              variant='outline'
                              size='sm'
                              onPress={() => setPickerState({ mode: 'date' })}>
                              <ButtonText className='text-xs'>
                                 {consumedAt.toLocaleDateString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                 })}
                              </ButtonText>
                           </Button>
                           <Button
                              variant='outline'
                              size='sm'
                              onPress={() => setPickerState({ mode: 'time' })}>
                              <ButtonText className='text-xs'>
                                 {consumedAt.toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                 })}
                              </ButtonText>
                           </Button>
                        </View>
                     </View>
                  )}

                  {pickerState.mode && (
                     <View className='items-center'>
                        <DateTimePicker
                           value={consumedAt}
                           mode={pickerState.mode}
                           display={
                              Platform.OS === 'ios'
                                 ? pickerState.mode === 'time'
                                    ? 'spinner'
                                    : parseInt(String(Platform.Version), 10) >= 14
                                      ? 'inline'
                                      : 'spinner'
                                 : pickerState.mode === 'time'
                                   ? 'clock'
                                   : 'calendar'
                           }
                           onChange={(e, d) => {
                              if (d) setConsumedAt(d);
                           }}
                        />
                        <View className='flex-row gap-2'>
                           <Button
                              variant='outline'
                              className='flex-1'
                              onPress={() => setPickerState({ mode: null })}>
                              <ButtonText>Set</ButtonText>
                           </Button>
                        </View>
                     </View>
                  )}

                  {!isAmountFocused && !quickEdit.active && !pickerState.mode && (
                     <View className='flex-row gap-2'>
                        <Button
                           variant='solid'
                           onPress={handleConfirm}
                           className='flex-1'>
                           <ButtonText>{isEditing ? 'Save' : 'Log'}</ButtonText>
                        </Button>
                        {isEditing && (
                           <Button
                              variant='solid'
                              className='bg-red-700 items-center justify-center w-8'
                              onPress={handleDelete}>
                              <Trash
                                 size={16}
                                 color={'white'}
                              />
                           </Button>
                        )}
                     </View>
                  )}

                  {quickEdit.active && (
                     <View className='px-2 gap-2'>
                        <View className='flex-row items-center gap-2'>
                           <Button
                              variant='solid'
                              onPress={saveQuick}
                              className='flex-1 justify-center'>
                              <ButtonText>Save</ButtonText>
                           </Button>

                           {quickEdit.index !== null && (
                              <Button
                                 variant='solid'
                                 className='bg-red-700 items-center justify-center w-8'
                                 onPress={deleteQuick}>
                                 <Trash
                                    size={16}
                                    color={'white'}
                                 />
                              </Button>
                           )}
                        </View>

                        <Button
                           variant='outline'
                           onPress={cancelQuick}
                           className='w-full'>
                           <ButtonText>Cancel</ButtonText>
                        </Button>
                     </View>
                  )}
               </View>
            </ActionsheetScrollView>
         </ActionsheetContent>
      </Actionsheet>
   );
};

export default IntakeDrawer;
