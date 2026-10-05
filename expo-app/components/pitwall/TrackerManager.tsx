import React, { useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { Check, ChevronRight, Plus, Star } from 'lucide-react-native';
import { Button, Input, ScrollView, Text, XStack, YStack } from 'tamagui';
import { PitwallSheet } from './PitwallOverlays';
import type { SaveTrackerInput, Tracker } from '@/lib/trackers';
import type { TrackerCategory } from '@/lib/trackerDatabase';
import {
   fetchTrackers,
   saveTrackerThunk,
   selectPrimaryTrackerId,
   selectTrackerError,
   selectTrackerInitialFetchStatus,
   selectTrackerMutationStatus,
   selectTrackers,
   setPrimaryTracker
} from '@/features/trackers/trackersSlice';
import { useAppDispatch, useAppSelector } from '@/store/hooks';

type FormValues = {
   name: string;
   category: TrackerCategory;
   unit: string;
   savedDose: string;
};

const emptyForm: FormValues = { name: '', category: 'supplement', unit: '', savedDose: '' };

function migrationMessage(error: string | null) {
   if (!error) return null;
   return /migration|not installed|tracked_items|tracker_entries|tracker_preferences|schema cache/i.test(error)
      ? 'Tracker storage is not ready for this account. Apply the tracker migration, then retry.'
      : error;
}

function displayDose(tracker: Tracker) {
   return tracker.savedDose === null ? 'Saved dose not set' : `${tracker.savedDose} ${tracker.unit} per log`;
}

/** Persistent editor for supplement and medication trackers. */
export function TrackerManager() {
   const dispatch = useAppDispatch();
   const trackers = useAppSelector(selectTrackers);
   const selectedTrackerId = useAppSelector(selectPrimaryTrackerId);
   const primaryTrackerId = trackers.find(tracker => tracker.id === selectedTrackerId)?.id
      ?? trackers.find(tracker => tracker.id === 'builtin:creatine')?.id;
   const initialFetchStatus = useAppSelector(selectTrackerInitialFetchStatus);
   const mutationStatus = useAppSelector(selectTrackerMutationStatus);
   const trackerError = useAppSelector(selectTrackerError);
   const [sheetOpen, setSheetOpen] = useState(false);
   const [editingTracker, setEditingTracker] = useState<Tracker | null>(null);
   const [form, setForm] = useState<FormValues>(emptyForm);
   const [formError, setFormError] = useState<string | null>(null);
   const [actionError, setActionError] = useState<string | null>(null);
   const [saving, setSaving] = useState(false);

   const loading = initialFetchStatus === 'loading';
   const storageError = initialFetchStatus === 'failed' ? migrationMessage(trackerError) : null;
   const globalMutationError = mutationStatus === 'failed' ? migrationMessage(trackerError) : null;

   function openCreate() {
      setEditingTracker(null);
      setForm(emptyForm);
      setFormError(null);
      setActionError(null);
      setSheetOpen(true);
   }

   function openEdit(tracker: Tracker) {
      setEditingTracker(tracker);
      setForm({
         name: tracker.name,
         category: tracker.category,
         unit: tracker.unit,
         savedDose: tracker.savedDose === null ? '' : String(tracker.savedDose)
      });
      setFormError(null);
      setActionError(null);
      setSheetOpen(true);
   }

   async function save() {
      const name = form.name.trim();
      const unit = form.unit.trim();
      const doseText = form.savedDose.trim();
      const savedDose = doseText === '' ? null : Number(doseText);
      if (!name) {
         setFormError('Enter a name for this tracker.');
         return;
      }
      if (!unit) {
         setFormError('Enter the unit to use for each log.');
         return;
      }
      if (savedDose !== null && (!Number.isFinite(savedDose) || savedDose <= 0)) {
         setFormError('Enter a positive dose or leave it blank.');
         return;
      }

      const input: SaveTrackerInput = {
         ...(editingTracker ? { id: editingTracker.id } : {}),
         name,
         category: form.category,
         unit,
         savedDose
      };
      setSaving(true);
      setFormError(null);
      try {
         await dispatch(saveTrackerThunk(input)).unwrap();
         setSheetOpen(false);
      } catch (error) {
         setFormError(migrationMessage(error instanceof Error ? error.message : String(error)) ?? 'Could not save this tracker.');
      } finally {
         setSaving(false);
      }
   }

   async function choosePrimary(tracker: Tracker) {
      setActionError(null);
      try {
         await dispatch(setPrimaryTracker(tracker.id)).unwrap();
      } catch (error) {
         setActionError(migrationMessage(error instanceof Error ? error.message : String(error)) ?? 'Could not set the Today tracker.');
      }
   }

   async function retry() {
      setActionError(null);
      try {
         await dispatch(fetchTrackers()).unwrap();
      } catch (error) {
         setActionError(migrationMessage(error instanceof Error ? error.message : String(error)) ?? 'Could not load trackers.');
      }
   }

   return (
      <YStack flex={1} minHeight={0} backgroundColor="#0c0c0c" paddingHorizontal={24} paddingTop={18}>
         <XStack alignItems="center" justifyContent="space-between" marginBottom={18}>
            <YStack gap={5}>
               <Text color="#e9e9e9" fontFamily="$display" fontSize={43} lineHeight={45} fontWeight="600" textTransform="uppercase">
                  Supps
               </Text>
               <Text color="#999999" fontFamily="$mono" fontSize={10} letterSpacing={0.2}>
                  SUPPLEMENTS / MEDICATIONS
               </Text>
            </YStack>
            <Button
               width={44}
               height={44}
               borderRadius={22}
               borderWidth={0}
               backgroundColor="#202020"
               color="#398eff"
               onPress={openCreate}
               role="button"
               aria-label="Add tracker">
               <Plus size={20} color="#398eff" />
            </Button>
         </XStack>

         {storageError && trackers.length === 0 ? (
            <YStack gap={14} paddingVertical={22} borderTopWidth={1} borderBottomWidth={1} borderColor="#353535">
               <Text role="alert" aria-live="assertive" color="#e9e9e9" fontFamily="$body" fontSize={14} lineHeight={20}>
                  {actionError ?? storageError}
               </Text>
               <Button height={44} borderRadius={4} borderWidth={1} borderColor="#555555" backgroundColor="transparent" color="#e9e9e9" onPress={retry} disabled={loading} role="button" aria-label="Retry loading trackers">
                  {loading ? <ActivityIndicator color="#398eff" /> : <Text color="#e9e9e9" fontFamily="$body" fontSize={13}>Retry</Text>}
               </Button>
            </YStack>
         ) : (
            <ScrollView flex={1} minHeight={0} showsVerticalScrollIndicator={false}>
               {actionError || globalMutationError ? (
                  <Text marginBottom={12} role="alert" aria-live="assertive" color="#ff9b91" fontFamily="$body" fontSize={13} lineHeight={19}>
                     {actionError ?? globalMutationError}
                  </Text>
               ) : null}
               {loading && trackers.length === 0 ? (
                  <XStack alignItems="center" gap={12} paddingVertical={24}>
                     <ActivityIndicator color="#398eff" />
                     <Text color="#aaaaaa" fontFamily="$body" fontSize={13}>Loading trackers…</Text>
                  </XStack>
               ) : trackers.length === 0 ? (
                  <YStack gap={10} paddingVertical={20} borderTopWidth={1} borderBottomWidth={1} borderColor="#353535">
                     <Text color="#e9e9e9" fontFamily="$body" fontSize={15} fontWeight="600">No trackers yet</Text>
                     <Text color="#999999" fontFamily="$body" fontSize={13} lineHeight={19}>Add a supplement or medication with its unit. Leave the saved dose blank if you do not want a one tap dose.</Text>
                     <Button alignSelf="flex-start" height={42} paddingHorizontal={14} borderRadius={4} borderWidth={1} borderColor="#454545" backgroundColor="transparent" color="#e9e9e9" onPress={openCreate} role="button" aria-label="Add tracker">
                        <Plus size={15} color="#398eff" />
                        <Text color="#e9e9e9" fontFamily="$body" fontSize={13}>Add tracker</Text>
                     </Button>
                  </YStack>
               ) : (
                  <YStack>
                     {trackers.map(tracker => {
                        const isPrimary = tracker.id === primaryTrackerId;
                        return (
                           <YStack key={tracker.id} minHeight={86} paddingVertical={12} borderBottomWidth={1} borderColor="#333333">
                              <XStack alignItems="center" gap={10}>
                                 <Button
                                    flex={1}
                                    minWidth={0}
                                    height={54}
                                    padding={0}
                                    borderWidth={0}
                                    borderRadius={0}
                                    backgroundColor="transparent"
                                    color="#e9e9e9"
                                    justifyContent="flex-start"
                                    onPress={() => openEdit(tracker)}
                                    role="button"
                                    aria-label={`Edit ${tracker.name}, ${tracker.category}, ${displayDose(tracker)}`}>
                                    <YStack flex={1} minWidth={0} alignItems="flex-start" justifyContent="center" gap={4}>
                                       <XStack alignItems="center" gap={8} maxWidth="100%">
                                          <Text color="#e9e9e9" fontFamily="$display" fontSize={26} lineHeight={28} fontWeight="600" textTransform="uppercase" numberOfLines={1}>
                                             {tracker.name}
                                          </Text>
                                          <Text color="#999999" fontFamily="$mono" fontSize={9} textTransform="uppercase" numberOfLines={1}>
                                             {tracker.category === 'medication' ? 'MED' : 'SUPP'}
                                          </Text>
                                       </XStack>
                                       <Text color="#999999" fontFamily="$mono" fontSize={10} numberOfLines={1}>
                                          {displayDose(tracker)}
                                       </Text>
                                    </YStack>
                                    <ChevronRight size={17} color="#777777" />
                                 </Button>
                                 <Button
                                    width={44}
                                    height={44}
                                    borderRadius={22}
                                    borderWidth={isPrimary ? 0 : 1}
                                    borderColor="#454545"
                                    backgroundColor={isPrimary ? '#398eff' : 'transparent'}
                                    color={isPrimary ? '#0c0c0c' : '#aaaaaa'}
                                    onPress={() => void choosePrimary(tracker)}
                                    disabled={loading || mutationStatus === 'loading'}
                                    role="button"
                                    aria-label={isPrimary ? `${tracker.name} is selected for Today` : `Use ${tracker.name} on Today`}
                                    aria-pressed={isPrimary}
                                    aria-disabled={loading || mutationStatus === 'loading'}>
                                    {isPrimary ? <Check size={17} color="#0c0c0c" /> : <Star size={16} color="#aaaaaa" />}
                                 </Button>
                              </XStack>
                           </YStack>
                        );
                     })}
                  </YStack>
               )}
            </ScrollView>
         )}

         <PitwallSheet
            open={sheetOpen}
            onOpenChange={open => {
               if (!saving) setSheetOpen(open);
            }}
            title={editingTracker ? 'Edit tracker' : 'Add tracker'}
            description="Set the name, type, unit, and optional saved dose used by one tap logging.">
            <YStack gap={16}>
               <Field label="Name">
                  <Input
                     value={form.name}
                     onChangeText={name => setForm(previous => ({ ...previous, name }))}
                     placeholder="e.g. Creatine"
                     maxLength={60}
                     autoCapitalize="words"
                     returnKeyType="next"
                     borderRadius={4}
                     borderColor="#454545"
                     backgroundColor="#0c0c0c"
                     color="#e9e9e9"
                     placeholderTextColor="$color8"
                     role="textbox"
                     aria-label="Tracker name" />
               </Field>

               <Field label="Type">
                  <XStack gap={8} role="radiogroup" aria-label="Tracker type">
                     <CategoryButton label="Supplement" selected={form.category === 'supplement'} onPress={() => setForm(previous => ({ ...previous, category: 'supplement' }))} />
                     <CategoryButton label="Medication" selected={form.category === 'medication'} onPress={() => setForm(previous => ({ ...previous, category: 'medication' }))} />
                  </XStack>
               </Field>

               <XStack gap={12}>
                  <Field label="Unit" flex={1}>
                     <Input
                        value={form.unit}
                        onChangeText={unit => setForm(previous => ({ ...previous, unit }))}
                        placeholder="g, mg, tablets…"
                        maxLength={24}
                        autoCapitalize="none"
                        borderRadius={4}
                        borderColor="#454545"
                        backgroundColor="#0c0c0c"
                        color="#e9e9e9"
                        placeholderTextColor="$color8"
                        role="textbox"
                        aria-label="Unit" />
                  </Field>
                  <Field label="Saved dose (optional)" flex={1}>
                     <Input
                        value={form.savedDose}
                        onChangeText={savedDose => setForm(previous => ({ ...previous, savedDose }))}
                        placeholder="Leave blank"
                        keyboardType="decimal-pad"
                        maxLength={16}
                        borderRadius={4}
                        borderColor="#454545"
                        backgroundColor="#0c0c0c"
                        color="#e9e9e9"
                        placeholderTextColor="$color8"
                        role="textbox"
                        aria-label="Saved dose, optional" />
                  </Field>
               </XStack>

               {formError ? (
                  <Text role="alert" aria-live="assertive" color="#ff9b91" fontFamily="$body" fontSize={13} lineHeight={19}>
                     {formError}
                  </Text>
               ) : null}

               <Button
                  height={46}
                  marginTop={2}
                  borderRadius={4}
                  borderWidth={1}
                  borderColor="#398eff"
                  backgroundColor="#398eff"
                  color="#0c0c0c"
                  onPress={() => void save()}
                  disabled={saving}
                  role="button"
                  aria-label={saving ? 'Saving tracker' : editingTracker ? 'Save tracker changes' : 'Create tracker'}>
                  {saving ? <ActivityIndicator color="#0c0c0c" /> : <Text color="#0c0c0c" fontFamily="$body" fontSize={14} fontWeight="600">{editingTracker ? 'Save changes' : 'Add tracker'}</Text>}
               </Button>
            </YStack>
         </PitwallSheet>
      </YStack>
   );
}

function Field({
   label,
   children,
   flex
}: {
   label: string;
   children: React.ReactNode;
   flex?: number;
}) {
   return (
      <YStack flex={flex} minWidth={0} gap={8}>
         <Text color="#aaaaaa" fontFamily="$mono" fontSize={10} textTransform="uppercase">{label}</Text>
         {children}
      </YStack>
   );
}

function CategoryButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
   return (
      <Button
         flex={1}
         height={42}
         borderRadius={4}
         borderWidth={1}
         borderColor={selected ? '#398eff' : '#454545'}
         backgroundColor={selected ? '#102039' : 'transparent'}
         color={selected ? '#e9e9e9' : '#aaaaaa'}
         onPress={onPress}
         role="radio"
         aria-label={label}
         aria-checked={selected}>
         <Text color={selected ? '#e9e9e9' : '#aaaaaa'} fontFamily="$body" fontSize={13}>{label}</Text>
      </Button>
   );
}

export default TrackerManager;
