import React, { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import { Button, Input, Select, Sheet, Text, XStack, YStack } from 'tamagui';
import DateTimePicker from '@react-native-community/datetimepicker';
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
   initial?: LogInitial;
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

const colors = { background: '#0c0c0c', text: '#e9e9e9', muted: '#999', blue: '#398eff', line: '#353535' } as const;

const LogActionSheet: React.FC<Props> = ({ isOpen, mode, initial, onClose, onSubmit, onDelete }) => {
   const [amount, setAmount] = useState(initial?.amount?.toString() ?? '');
   const [type, setType] = useState(initial?.consumable ?? (mode === 'water' ? 'water' : 'Monohydrate'));
   const [keyboardHeight, setKeyboardHeight] = useState(0);
   const [showPicker, setShowPicker] = useState<{ mode: 'date' | 'time'; visible: boolean }>({ mode: 'time', visible: false });
   const [consumedAt, setConsumedAt] = useState(initial?.consumed_at ? new Date(initial.consumed_at) : new Date());
   const [tempConsumedAt, setTempConsumedAt] = useState<Date | null>(null);

   useEffect(() => {
      setAmount(initial?.amount?.toString() ?? '');
      setType(initial?.consumable ?? (mode === 'water' ? 'water' : 'Monohydrate'));
      setConsumedAt(initial?.consumed_at ? new Date(initial.consumed_at) : new Date());
      setTempConsumedAt(null);
   }, [initial, mode, isOpen]);

   useEffect(() => {
      const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (event) => setKeyboardHeight(event.endCoordinates.height));
      const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardHeight(0));
      return () => { show.remove(); hide.remove(); };
   }, []);

   const submit = () => {
      const parsed = Number(amount || 0);
      const unit = mode === 'water' ? 'oz' : 'g';
      const consumable = mode === 'water' ? type : 'creatine';
      onSubmit({ id: initial?.id, amount: parsed, unit, consumable, consumed_at: consumedAt.toISOString() });
      onClose();
   };

   const handleDelete = () => {
      if (initial?.id && onDelete) onDelete(initial.id);
      onClose();
   };

   const handleClose = () => {
      onClose();
      setTimeout(() => { setTempConsumedAt(null); setShowPicker((state) => ({ ...state, visible: false })); }, 250);
   };

   const selectControl = (value: string, options: readonly string[], onValueChange: (value: string) => void, label: string) => <Select value={value} onValueChange={onValueChange}>
      <Select.Trigger role="combobox" aria-label={label} minHeight={48} borderRadius={2} borderColor={colors.line} backgroundColor="transparent">
         <Select.Value placeholder={`Select ${label.toLowerCase()}`} />
         <Select.Icon />
      </Select.Trigger>
      <Select.Content>
         <Select.Viewport>
            {options.map((option, index) => <Select.Item key={option} index={index} value={option}>
               <Select.ItemText>{option}</Select.ItemText><Select.ItemIndicator />
            </Select.Item>)}
         </Select.Viewport>
      </Select.Content>
   </Select>;

   const openDate = (pickerMode: 'date' | 'time') => {
      setTempConsumedAt(consumedAt);
      setShowPicker({ mode: pickerMode, visible: true });
   };

   return <Sheet open={isOpen} onOpenChange={(open: boolean) => { if (!open) handleClose(); }} modal snapPoints={[82]} snapPointsMode="percent" dismissOnOverlayPress moveOnKeyboardChange zIndex={100000}>
      <Sheet.Overlay backgroundColor="#000000bb" />
      <Sheet.Frame backgroundColor={colors.background} borderTopWidth={1} borderColor={colors.line} paddingBottom={Math.max(18, keyboardHeight + 16)} maxHeight="90%">
         <Sheet.Handle backgroundColor="#666" />
         <Sheet.ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 16, paddingBottom: 24, gap: 19 }}>
            <YStack gap={5}>
               <Text color={colors.text} fontFamily="$heading" fontSize={30} fontWeight="600">{initial ? 'Edit intake' : `Log ${mode}`}</Text>
               <Text color={colors.muted} fontFamily="$mono" fontSize={10}>{mode.toUpperCase()} · {consumedAt.toLocaleDateString()}</Text>
            </YStack>

            <XStack justifyContent="space-between" gap={10}>
               {(['date', 'time'] as const).map((pickerMode) => <Button key={pickerMode} unstyled onPress={() => openDate(pickerMode)} role="button" aria-label={`Choose ${pickerMode}`} flex={1} minHeight={48} borderWidth={1} borderColor={colors.line} borderRadius={2} paddingHorizontal={10} justifyContent="center">
                  <YStack gap={4}>
                     <Text color={colors.muted} fontFamily="$mono" fontSize={9}>{pickerMode.toUpperCase()}</Text>
                     <Text color={colors.text} fontFamily="$body" fontSize={13}>{pickerMode === 'date' ? consumedAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : consumedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                  </YStack>
               </Button>)}
            </XStack>

            {showPicker.visible ? <YStack gap={12} alignItems="center">
               <DateTimePicker value={tempConsumedAt ?? consumedAt} mode={showPicker.mode} is24Hour={false} display="spinner" onChange={(_event, date) => { if (date) setTempConsumedAt(date); }} />
               <XStack gap={8} width="100%">
                  <Button onPress={() => { setTempConsumedAt(null); setShowPicker((state) => ({ ...state, visible: false })); }} flex={1} minHeight={46} borderRadius={2} borderWidth={1} borderColor={colors.line} backgroundColor="transparent"><Text color={colors.muted}>Cancel</Text></Button>
                  <Button onPress={() => { if (tempConsumedAt) setConsumedAt(tempConsumedAt); setTempConsumedAt(null); setShowPicker((state) => ({ ...state, visible: false })); }} flex={1} minHeight={46} borderRadius={2} backgroundColor={colors.text}><Text color={colors.background} fontWeight="700">Confirm</Text></Button>
               </XStack>
            </YStack> : <>
               <YStack gap={8}>
                  <Text color={colors.muted} fontFamily="$mono" fontSize={10}>{mode === 'water' ? 'AMOUNT · OZ' : 'AMOUNT · GRAMS'}</Text>
                  <Input value={amount} onChangeText={setAmount} placeholder="0" keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'} aria-label={mode === 'water' ? 'Amount in ounces' : 'Amount in grams'} height={50} borderRadius={2} borderColor={colors.line} backgroundColor="transparent" color={colors.text} fontFamily="$body" fontSize={15} />
               </YStack>

               <YStack gap={8}>
                  <Text color={colors.muted} fontFamily="$mono" fontSize={10}>{mode === 'water' ? 'DRINK TYPE' : 'FORM'}</Text>
                  {selectControl(type, mode === 'water' ? DRINK_TYPES : ['Monohydrate', 'HCL', 'Micronized'], setType, mode === 'water' ? 'Drink type' : 'Creatine form')}
               </YStack>

               <Button onPress={submit} disabled={!amount} minHeight={50} borderRadius={2} backgroundColor={colors.blue} role="button">
                  <Text color={colors.background} fontFamily="$body" fontSize={14} fontWeight="700">{initial ? 'Save entry' : `Log ${mode}`}</Text>
               </Button>
               {initial?.id && onDelete && <Button onPress={handleDelete} minHeight={48} borderRadius={2} borderWidth={1} borderColor="#6b3434" backgroundColor="transparent" role="button">
                  <Text color="#ff8585" fontFamily="$body" fontSize={14}>Delete entry</Text>
               </Button>}
            </>}
         </Sheet.ScrollView>
      </Sheet.Frame>
   </Sheet>;
};

export default LogActionSheet;
