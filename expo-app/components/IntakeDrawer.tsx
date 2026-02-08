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
import { CalendarClock, Minus, Plus, Trash, Check, Pencil } from 'lucide-react-native';
import { Checkbox, CheckboxIndicator, CheckboxLabel, CheckboxIcon } from '@/components/ui/checkbox';
import { selectCreatineLogs } from '@/features/intake/intakeSlice';

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
   const creatineLogs = useAppSelector(selectCreatineLogs) as Array<{
      id: string;
      amount: number;
      unit: string;
      consumable: string;
      consumed_at: string;
   }>;

   const isEditing = Boolean(initial?.id);

   const [waterAmount, setWaterAmount] = React.useState<number>(initial?.amount ?? 0);
   const [includeCreatine, setIncludeCreatine] = React.useState<boolean>(false);
   // Creatine pair editing (for water+creatine quick pair)
   const [creatineEditing, setCreatineEditing] = React.useState<boolean>(false);
   const [creatineAmount, setCreatineAmount] = React.useState<number>(5);
   const [creatineAmountText, setCreatineAmountText] = React.useState<string>('5');
   const [creatinePrevAmount, setCreatinePrevAmount] = React.useState<number | null>(null);
   const [prevIncludeCreatine, setPrevIncludeCreatine] = React.useState<boolean | null>(null);
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

   // Close handler: just notify parent to close; we'll reset local state after the sheet finishes hiding
   const handleClose = React.useCallback(() => {
      onClose();
   }, [onClose]);

   // When parent closes the sheet, wait until the sheet hides (animation) before resetting visible values
   const resetTimer = React.useRef<number | null>(null);
   React.useEffect(() => {
      // If sheet just closed, schedule a delayed reset so user doesn't see values snap during animation
      if (!isOpen) {
         // clear any previous timer
         if (resetTimer.current) {
            clearTimeout(resetTimer.current);
            resetTimer.current = null;
         }
         resetTimer.current = setTimeout(() => {
            setQuickEdit({ active: false, index: null });
            setIsAmountFocused(false);
            setPickerState({ mode: null });
            setIncludeCreatine(false);
            setWaterAmount(0);
            setWaterAmountText('0');
            // reset creatine editing state
            setCreatineEditing(false);
            setCreatineAmount(5);
            setCreatineAmountText('5');
            setCreatinePrevAmount(null);
            setPrevIncludeCreatine(null);
            resetTimer.current = null;
         }, 350) as unknown as number; // 350ms matches typical sheet hide animation
      } else {
         // If reopened, cancel any pending reset
         if (resetTimer.current) {
            clearTimeout(resetTimer.current);
            resetTimer.current = null;
         }
      }

      return () => {
         if (resetTimer.current) {
            clearTimeout(resetTimer.current);
            resetTimer.current = null;
         }
      };
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
      // Reflect paired entries from history (water + creatine at same time)
      setIncludeCreatine(initial?.consumable === 'water+creatine');
      // If editing an existing creatine-only log, ensure labels/input follow grams (amount lives in waterAmount)
      if (initial?.consumable === 'creatine') {
         setCreatineAmount(initial.amount ?? 5);
         setCreatineAmountText(String(initial.amount ?? 5));
      }
      // If editing a paired (water+creatine) entry, load the paired creatine amount from store
      if (initial?.consumable === 'water+creatine' && initial.consumed_at) {
         const pair = creatineLogs.find((l) => l.consumed_at === initial.consumed_at);
         if (pair) {
            setCreatineAmount(pair.amount ?? 5);
            setCreatineAmountText(String(pair.amount ?? 5));
         } else {
            // fallback to default if not found
            setCreatineAmount(5);
            setCreatineAmountText('5');
         }
      }
   }, [initial, isOpen, creatineLogs]);

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
      } else if (creatineEditing) {
         // Adjust creatine grams
         setCreatineAmount((prev) => Math.max(0, Math.round((prev + delta) * 100) / 100));
         setCreatineAmountText((prev) => {
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
         // If this edit belongs to a paired water+creatine entry, also persist creatine side
         if (initial.consumable === 'water+creatine') {
            const pair = creatineLogs.find((l) => l.consumed_at === initial.consumed_at);
            if (includeCreatine) {
               const grams = Math.max(0, Math.round(creatineAmount * 100) / 100) || 5;
               if (pair) {
                  await dispatch(
                     updateIntakeLog({ id: pair.id, amount: grams, unit: 'g', consumed_at: when })
                  );
               } else {
                  await dispatch(addCreatineLog({ amount: grams, unit: 'g', consumed_at: when }));
               }
            } else if (pair) {
               // User unchecked creatine while editing a paired entry -> remove the creatine log
               await dispatch(deleteIntakeLog(pair.id));
            }
         }
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
            const grams = Math.max(0, Math.round(creatineAmount * 100) / 100) || 5;
            await dispatch(addCreatineLog({ amount: grams, unit: 'g', consumed_at: when }));
         }
      }
      onClose();
   };

   const handleDelete = async () => {
      if (!initial?.id) return;

      // Always delete the currently edited log
      const deletions: Array<Promise<any>> = [dispatch(deleteIntakeLog(initial.id)) as any];

      // If it's a combined entry, also delete the paired creatine log(s) at the same timestamp
      if (initial.consumable === 'water+creatine' && initial.consumed_at) {
         const pairs = creatineLogs.filter((l) => l.consumed_at === initial.consumed_at);
         for (const p of pairs) {
            deletions.push(dispatch(deleteIntakeLog(p.id)) as any);
         }
      }

      await Promise.allSettled(deletions);
      onClose();
   };

   // Determine display unit and quick amounts (water-centric)
   const displayUnit = isEditing ? initial?.unit ?? drinkUnit : drinkUnit;
   const waterDefaults = drinkUnit === 'ml' ? [250, 330, 500, 750] : defaultQuick;
   const quicks = quicksLocal;
   const isCreatineOnly = isEditing && initial?.consumable === 'creatine';
   const amountLabel = isCreatineOnly || creatineEditing ? 'GRAMS' : 'OUNCES';

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
                        value={
                           quickEdit.active
                              ? quickEditText
                              : creatineEditing
                              ? creatineAmountText
                              : waterAmountText
                        }
                        onChangeText={(t) => {
                           if (quickEdit.active) {
                              setQuickEditText(t);
                              const parsed = Number(t.replace(',', '.'));
                              if (!Number.isNaN(parsed)) setQuickEditValue(parsed);
                           } else if (creatineEditing) {
                              setCreatineAmountText(t);
                              const parsed = Number(t.replace(',', '.'));
                              if (!Number.isNaN(parsed)) setCreatineAmount(parsed);
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
                     <Text className='text-typography-500'>{amountLabel}</Text>
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
                  {!quickEdit.active && !creatineEditing && !isCreatineOnly && (
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
                     <View className='flex-row items-center justify-between'>
                        <View className='flex-row gap-1 items-center'>
                           <CalendarClock
                              color={'gray'}
                              size={20}
                           />
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
                        {!isCreatineOnly && (
                           <View className='flex-row gap-0 items-center'>
                              <Checkbox
                                 size='md'
                                 value='creatine'
                                 isChecked={includeCreatine}
                                 onChange={(checked) => setIncludeCreatine(Boolean(checked))}>
                                 <CheckboxIndicator>
                                    <CheckboxIcon as={Check} />
                                 </CheckboxIndicator>
                                 {/* this shouldn't always be grams @ridha */}
                                 <CheckboxLabel className='text-sm'>{`${creatineAmount}g Creatine`}</CheckboxLabel>
                              </Checkbox>
                              <Button
                                 variant='link'
                                 size='sm'
                                 className='py-4 px-3'
                                 onPress={() => {
                                    // Start creatine edit mode; ensure creatine is included
                                    setPrevIncludeCreatine(includeCreatine);
                                    setIncludeCreatine(true);
                                    setCreatinePrevAmount(creatineAmount);
                                    setCreatineEditing(true);
                                    setIsAmountFocused(true);
                                    setPickerState({ mode: null });
                                 }}>
                                 <Pencil
                                    color={'gray'}
                                    size={16}
                                 />
                              </Button>
                           </View>
                        )}
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

                  {!creatineEditing &&
                     !isAmountFocused &&
                     !quickEdit.active &&
                     !pickerState.mode && (
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

                  {creatineEditing && (
                     <View className='px-2 gap-2'>
                        <View className='flex-row items-center gap-2'>
                           <Button
                              variant='solid'
                              onPress={() => {
                                 // Commit creatine amount and exit edit mode
                                 const parsed = Number(creatineAmountText.replace(',', '.'));
                                 const grams = Number.isNaN(parsed) ? creatineAmount : parsed;
                                 const finalVal = Math.max(0, Math.round(grams * 100) / 100);
                                 setCreatineAmount(finalVal);
                                 setCreatineAmountText(String(finalVal));
                                 setCreatineEditing(false);
                                 setIsAmountFocused(false);
                                 setCreatinePrevAmount(null);
                                 setPrevIncludeCreatine(null);
                              }}
                              className='flex-1 justify-center'>
                              <ButtonText>Save</ButtonText>
                           </Button>
                        </View>

                        <Button
                           variant='outline'
                           onPress={() => {
                              // Revert any changes and exit edit mode
                              if (creatinePrevAmount !== null) {
                                 setCreatineAmount(creatinePrevAmount);
                                 setCreatineAmountText(String(creatinePrevAmount));
                              }
                              if (prevIncludeCreatine !== null) {
                                 setIncludeCreatine(prevIncludeCreatine);
                              }
                              setCreatineEditing(false);
                              setIsAmountFocused(false);
                              setCreatinePrevAmount(null);
                              setPrevIncludeCreatine(null);
                           }}
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
