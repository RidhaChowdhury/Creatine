import React from 'react';
import { Keyboard, Platform } from 'react-native';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { Button, Input, ScrollView, Sheet, Text, XStack, YStack } from 'tamagui';
import DateTimePicker from '@react-native-community/datetimepicker';
import { selectDrinkUnit } from '@/features/settings/settingsSlice';
import {
   addDrinkLog,
   addCreatineLog,
   updateIntakeLog,
   deleteIntakeLog
} from '@/features/intake/intakeSlice';
import { CalendarClock, Minus, Plus, Trash, Pencil } from 'lucide-react-native';
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
   const [saving, setSaving] = React.useState(false);
   const [actionError, setActionError] = React.useState('');
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
      if (isOpen) setActionError('');
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
      if (saving) return;
      setSaving(true);
      setActionError('');
      const when = toSqlDateTime(consumedAt);
      try {
         if (isEditing && initial?.id) {
            await dispatch(updateIntakeLog({ id: initial.id, amount: waterAmount, unit: initial.unit, consumed_at: when })).unwrap();
            if (initial.consumable === 'water+creatine') {
               const pair = creatineLogs.find((l) => l.consumed_at === initial.consumed_at);
               if (includeCreatine) {
                  const grams = Math.max(0, Math.round(creatineAmount * 100) / 100) || 5;
                  if (pair) await dispatch(updateIntakeLog({ id: pair.id, amount: grams, unit: 'g', consumed_at: when })).unwrap();
                  else await dispatch(addCreatineLog({ amount: grams, unit: 'g', consumed_at: when })).unwrap();
               } else if (pair) await dispatch(deleteIntakeLog(pair.id)).unwrap();
            }
         } else {
            if (waterAmount > 0) await dispatch(addDrinkLog({ amount: waterAmount, consumable: 'water' as any, unit: drinkUnit, consumed_at: when })).unwrap();
            if (includeCreatine) {
               const grams = Math.max(0, Math.round(creatineAmount * 100) / 100) || 5;
               await dispatch(addCreatineLog({ amount: grams, unit: 'g', consumed_at: when })).unwrap();
            }
         }
         onClose();
      } catch (error) {
         setActionError((error as Error).message || 'Unable to save this intake. Please try again.');
      } finally {
         setSaving(false);
      }
   };

   const handleDelete = async () => {
      if (!initial?.id || saving) return;
      setSaving(true);
      setActionError('');

      try {
         const deletions: Array<Promise<unknown>> = [dispatch(deleteIntakeLog(initial.id)).unwrap()];
         if (initial.consumable === 'water+creatine' && initial.consumed_at) {
            const pairs = creatineLogs.filter((l) => l.consumed_at === initial.consumed_at);
            for (const pair of pairs) deletions.push(dispatch(deleteIntakeLog(pair.id)).unwrap());
         }
         const results = await Promise.allSettled(deletions);
         const failed = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
         if (failed) throw failed.reason;
         onClose();
      } catch (error) {
         setActionError((error as Error).message || 'Unable to delete this intake. Please try again.');
      } finally {
         setSaving(false);
      }
   };

   // Determine display unit and quick amounts (water-centric)
   const displayUnit = isEditing ? (initial?.unit ?? drinkUnit) : drinkUnit;
   const quicks = quicksLocal;
   const isCreatineOnly = isEditing && initial?.consumable === 'creatine';
   const amountLabel = isCreatineOnly || creatineEditing ? 'GRAMS' : displayUnit.toUpperCase();
   const accent = '#398eff';
   const fg = '#e9e9e9';
   const muted = '#999';
   const line = '#353535';
   const activeText = quickEdit.active ? quickEditText : creatineEditing ? creatineAmountText : waterAmountText;

   return <Sheet open={isOpen} onOpenChange={(open: boolean) => { if (!open) handleClose(); }} modal snapPoints={[88]} snapPointsMode="percent" dismissOnOverlayPress moveOnKeyboardChange zIndex={100000}>
      <Sheet.Overlay backgroundColor="#000000bb" />
      <Sheet.Frame backgroundColor="#0c0c0c" borderTopWidth={1} borderColor={line} paddingBottom={Math.max(18, keyboardHeight + 16)} maxHeight="92%">
         <Sheet.Handle backgroundColor="#666" />
         <Sheet.ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, gap: 18 }}>
            <YStack gap={5}>
               <Text color={fg} fontFamily="$heading" fontSize={28} fontWeight="600">{isEditing ? 'Edit intake' : 'Log intake'}</Text>
               <Text color={muted} fontFamily="$mono" fontSize={10}>{isCreatineOnly ? 'CREATINE' : 'WATER'} · {consumedAt.toLocaleDateString()}</Text>
            </YStack>

            <XStack alignItems="center" justifyContent="space-between" gap={10}>
               <Button unstyled onPress={() => adjustAmount(-1)} role="button" aria-label="Decrease amount" width={52} height={52} borderWidth={1} borderColor={line} borderRadius={2} alignItems="center" justifyContent="center"><Minus size={19} color={fg} /></Button>
               <YStack flex={1} alignItems="center" gap={2}>
                  <Input value={activeText} onChangeText={(value) => {
                     if (quickEdit.active) {
                        setQuickEditText(value);
                        const parsed = Number(value.replace(',', '.'));
                        if (!Number.isNaN(parsed)) setQuickEditValue(parsed);
                     } else if (creatineEditing) {
                        setCreatineAmountText(value);
                        const parsed = Number(value.replace(',', '.'));
                        if (!Number.isNaN(parsed)) setCreatineAmount(parsed);
                     } else {
                        setWaterAmountText(value);
                        const parsed = Number(value.replace(',', '.'));
                        if (!Number.isNaN(parsed)) setWaterAmount(parsed);
                     }
                  }} onFocus={() => { setIsAmountFocused(true); setPickerState({ mode: null }); }} onBlur={() => setIsAmountFocused(false)} keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'} returnKeyType="done" aria-label={`Amount in ${amountLabel}`} textAlign="center" borderWidth={0} backgroundColor="transparent" color={fg} fontFamily="$heading" fontSize={62} fontWeight="600" height={75} padding={0} />
                  <Text color={muted} fontFamily="$mono" fontSize={10} letterSpacing={1}>{amountLabel}</Text>
               </YStack>
               <Button unstyled onPress={() => adjustAmount(1)} role="button" aria-label="Increase amount" width={52} height={52} borderWidth={1} borderColor={line} borderRadius={2} alignItems="center" justifyContent="center"><Plus size={19} color={fg} /></Button>
            </XStack>

            {!quickEdit.active && !creatineEditing && !isCreatineOnly && <XStack alignItems="center" gap={8}>
               <ScrollView horizontal showsHorizontalScrollIndicator={false} flex={1}>
                  <XStack gap={8}>
                     {quicks.map((quick, index) => <Button key={`${quick}-${index}`} onPress={() => handleQuick(quick)} onLongPress={() => startEditQuick(index)} minHeight={44} minWidth={62} borderRadius={2} borderWidth={1} borderColor={line} backgroundColor="transparent" role="button" aria-label={`${quick} ${displayUnit}; hold to edit`}>
                        <Text color={fg} fontFamily="$mono" fontSize={12}>{quick} {displayUnit}</Text>
                     </Button>)}
                  </XStack>
               </ScrollView>
               <Button onPress={startAddQuick} minHeight={44} minWidth={44} borderRadius={2} borderWidth={1} borderColor={line} backgroundColor="transparent" role="button" aria-label="Add quick amount"><Plus size={18} color={accent} /></Button>
            </XStack>}

            {!isAmountFocused && !quickEdit.active && <YStack gap={12}>
               <XStack alignItems="center" gap={8}>
                  <CalendarClock color={muted} size={16} />
                  <Button unstyled onPress={() => setPickerState({ mode: 'date' })} role="button" aria-label="Choose date" minHeight={44} paddingHorizontal={10} borderWidth={1} borderColor={line} borderRadius={2} justifyContent="center">
                     <Text color={fg} fontFamily="$mono" fontSize={10}>{consumedAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                  </Button>
                  <Button unstyled onPress={() => setPickerState({ mode: 'time' })} role="button" aria-label="Choose time" minHeight={44} paddingHorizontal={10} borderWidth={1} borderColor={line} borderRadius={2} justifyContent="center">
                     <Text color={fg} fontFamily="$mono" fontSize={10}>{consumedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                  </Button>
               </XStack>
               {!isCreatineOnly && <XStack alignItems="center" justifyContent="space-between" minHeight={44} borderTopWidth={1} borderColor="#262626" paddingTop={9}>
                  <Button unstyled onPress={() => setIncludeCreatine((value) => !value)} role="checkbox" aria-checked={includeCreatine} minHeight={44} flex={1} justifyContent="flex-start">
                     <XStack alignItems="center" gap={10}>
                        <YStack width={19} height={19} borderWidth={1} borderColor={includeCreatine ? accent : '#666'} backgroundColor={includeCreatine ? accent : 'transparent'} borderRadius={2} alignItems="center" justifyContent="center">{includeCreatine ? <Text color="#0c0c0c" fontSize={13} fontWeight="800">✓</Text> : null}</YStack>
                        <Text color={fg} fontFamily="$body" fontSize={13}>{creatineAmount} g creatine</Text>
                     </XStack>
                  </Button>
                  <Button unstyled onPress={() => {
                     setPrevIncludeCreatine(includeCreatine); setIncludeCreatine(true); setCreatinePrevAmount(creatineAmount);
                     setCreatineEditing(true); setIsAmountFocused(true); setPickerState({ mode: null });
                  }} role="button" aria-label="Edit creatine amount" width={44} height={44} alignItems="center" justifyContent="center"><Pencil size={15} color={muted} /></Button>
               </XStack>}
            </YStack>}

            {pickerState.mode && <YStack alignItems="center" gap={10}>
               <DateTimePicker value={consumedAt} mode={pickerState.mode} display={Platform.OS === 'ios' ? pickerState.mode === 'time' ? 'spinner' : parseInt(String(Platform.Version), 10) >= 14 ? 'inline' : 'spinner' : pickerState.mode === 'time' ? 'clock' : 'calendar'} onChange={(_event, date) => { if (date) setConsumedAt(date); }} />
               <Button onPress={() => setPickerState({ mode: null })} minHeight={44} alignSelf="stretch" borderRadius={2} borderWidth={1} borderColor={line} backgroundColor="transparent"><Text color={fg} fontFamily="$body" fontSize={14}>Set date and time</Text></Button>
            </YStack>}

            {quickEdit.active && <YStack gap={8}>
               <XStack gap={8}>
                  <Button onPress={saveQuick} flex={1} minHeight={48} borderRadius={2} backgroundColor={fg}><Text color="#0c0c0c" fontFamily="$body" fontWeight="700">Save quick amount</Text></Button>
                  {quickEdit.index !== null && <Button onPress={deleteQuick} minWidth={48} minHeight={48} borderRadius={2} backgroundColor="#552626" aria-label="Delete quick amount"><Trash size={17} color={fg} /></Button>}
               </XStack>
               <Button onPress={cancelQuick} minHeight={44} borderRadius={2} borderWidth={1} borderColor={line} backgroundColor="transparent"><Text color={muted}>Cancel</Text></Button>
            </YStack>}

            {creatineEditing && <YStack gap={8}>
               <Button onPress={() => {
                  const parsed = Number(creatineAmountText.replace(',', '.'));
                  const grams = Number.isNaN(parsed) ? creatineAmount : parsed;
                  const finalVal = Math.max(0, Math.round(grams * 100) / 100);
                  setCreatineAmount(finalVal); setCreatineAmountText(String(finalVal)); setCreatineEditing(false);
                  setIsAmountFocused(false); setCreatinePrevAmount(null); setPrevIncludeCreatine(null);
               }} minHeight={48} borderRadius={2} backgroundColor={fg}><Text color="#0c0c0c" fontFamily="$body" fontWeight="700">Save creatine amount</Text></Button>
               <Button onPress={() => {
                  if (creatinePrevAmount !== null) { setCreatineAmount(creatinePrevAmount); setCreatineAmountText(String(creatinePrevAmount)); }
                  if (prevIncludeCreatine !== null) setIncludeCreatine(prevIncludeCreatine);
                  setCreatineEditing(false); setIsAmountFocused(false); setCreatinePrevAmount(null); setPrevIncludeCreatine(null);
               }} minHeight={44} borderRadius={2} borderWidth={1} borderColor={line} backgroundColor="transparent"><Text color={muted}>Cancel</Text></Button>
            </YStack>}

            {actionError ? <Text color="#ff8585" fontFamily="$body" fontSize={12} role="alert" aria-live="polite">{actionError}</Text> : null}
            {!creatineEditing && !isAmountFocused && !quickEdit.active && !pickerState.mode && <XStack gap={8}>
               <Button onPress={() => { void handleConfirm(); }} disabled={saving} flex={1} minHeight={50} borderRadius={2} backgroundColor={accent} role="button" opacity={saving ? 0.6 : 1}><Text color="#0c0c0c" fontFamily="$body" fontSize={14} fontWeight="700">{saving ? 'Saving…' : isEditing ? 'Save entry' : 'Log entry'}</Text></Button>
               {isEditing && <Button onPress={() => { void handleDelete(); }} disabled={saving} minWidth={50} minHeight={50} borderRadius={2} borderWidth={1} borderColor="#6b3434" backgroundColor="transparent" role="button" aria-label="Delete this entry" opacity={saving ? 0.6 : 1}><Trash size={17} color="#ff8585" /></Button>}
            </XStack>}
         </Sheet.ScrollView>
      </Sheet.Frame>
   </Sheet>;
};

export default IntakeDrawer;
