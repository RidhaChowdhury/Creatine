import { View, SafeAreaView, TouchableOpacity, Alert } from 'react-native';
import React, { useState, useEffect, useCallback, useContext, ChangeEvent } from 'react';
import { Text } from '@/components/ui/text';
import { Fab } from '@/components/ui/fab';
import { GlassWater } from 'lucide-react-native';
import CreatineScoopIcon from '@/components/CreatineScoop';
import { WaterLogActionsheet } from '@/components/WaterLogActionSheet';
import { CreatineLogActionsheet } from '@/components/CreatineLogActionSheet';
import { HStack } from '@/components/ui/hstack';
import { Button, ButtonText } from '@/components/ui/button';
import { WaveBackground } from '@/components/WaveBackground';
import ConfettiCannon from 'react-native-confetti-cannon';
import Animated, { FadeIn, FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectDailyWaterTotal, selectDailyCreatineTotal } from '@/features/intake/intakeSlice';
import {
   selectDrinkUnit,
   selectInitialFetchStatus,
   selectSupplementUnit,
   selectWaterGoal,
   updateCreatineReminderTime
} from '@/features/settings/settingsSlice';
import { NotificationService } from '@/lib/notifications';
import { Modal, ModalBackdrop, ModalContent, ModalHeader } from '@/components/ui/modal';
import { Heading } from '@/components/ui/heading';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

const Today = () => {
   const dispatch = useAppDispatch();

   const waterAmount = useAppSelector(selectDailyWaterTotal);
   const creatineAmount = useAppSelector(selectDailyCreatineTotal);
   const waterGoal = useAppSelector(selectWaterGoal);
   const drinkUnit = useAppSelector(selectDrinkUnit);
   const supplementUnit = useAppSelector(selectSupplementUnit);

   const [showWaterSheet, setShowWaterSheet] = useState(false);
   const [showCreatineSheet, setShowCreatineSheet] = useState(false);
   const [animationKey, setAnimationKey] = useState(0);
   const [showModal, setShowModal] = useState(false);
   const [date, setDate] = useState(new Date());

   const getTimeString = (date: Date) => {
      const hh = date.getHours().toString().padStart(2, '0');
      const mm = date.getMinutes().toString().padStart(2, '0');
      const ss = date.getSeconds().toString().padStart(2, '0');
      const timeString = `${hh}:${mm}:${ss}`;

      return timeString;
   };

   const initialFetchStatus = useAppSelector(selectInitialFetchStatus);

   // notifications
   useEffect(() => {
      if (initialFetchStatus === 'succeeded') {
         (async () => {
            const { showReminderTimeModal } = await NotificationService.initialize();
            if (showReminderTimeModal) {
               setShowModal(true);
            }
         })();
      }
   }, [initialFetchStatus]);

   useFocusEffect(
      useCallback(() => {
         setAnimationKey((prevKey) => prevKey + 1); // Change key on every focus
      }, [])
   );

   useEffect(() => {
      if (waterAmount >= waterGoal) {
         const triggerHaptic = async () => {
            for (let i = 0; i < 3; i++) {
               await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
               await new Promise((resolve) => setTimeout(resolve, 100)); // Small delay between buzzes
            }
         };
         triggerHaptic();
      }
   }, [waterAmount, waterGoal]);

   const onChange = (event: DateTimePickerEvent, selectedDate: Date | undefined) => {
      const currentDate = selectedDate || date;
      setDate(currentDate);
   };

   return (
      <SafeAreaView className='bg-background-0 flex-1'>
         <WaveBackground
            progressPercent={waterAmount / waterGoal}
            offsetPercentage={2}
            // waveColor="rgba(100, 200, 255, 0.6)"
         />

         {waterAmount >= waterGoal && (
            <ConfettiCannon
               count={100}
               origin={{ x: -10, y: 0 }}
               autoStartDelay={600}
               fadeOut={true}
            />
         )}

         {/* Creatine Section */}
         <View className='absolute top-20 left-5'>
            <View className='flex-row items-end justify-end gap-1'>
               <Text className='text-3xl font-bold text-white'>{creatineAmount}</Text>
               <Text className='text-xl text-neutral-300 pb-1'>{supplementUnit}</Text>
            </View>
         </View>
         {/* Water Section */}
         <View className='flex-1 justify-center items-center'>
            <View className='flex-row items-end gap-2'>
               <Text className='text-5xl font-bold text-white'>{waterAmount}</Text>
               <Text className='text-xl text-neutral-300 pb-1'>{drinkUnit}</Text>
            </View>
         </View>

         <HStack
            className='absolute bottom-4 right-4'
            space='xl'>
            {/* Creatine Button (left) */}
            <Animated.View
               key={animationKey}
               entering={FadeInDown.duration(1000).delay(100).springify().damping(12)}>
               <Button
                  size='lg'
                  className='bg-primary-0 rounded-full w-20 h-20'
                  onPress={() => setShowCreatineSheet(true)}>
                  <CreatineScoopIcon
                     color={'white'}
                     size={50}
                  />
               </Button>
            </Animated.View>

            {/* Water Button (right) */}
            <Animated.View
               key={`water-${animationKey}`}
               entering={FadeInDown.duration(1000).delay(100).springify().damping(12)}>
               <Button
                  size='lg'
                  className='bg-primary-0 rounded-full w-20 h-20'
                  onPress={() => setShowWaterSheet(true)}>
                  <GlassWater
                     color={'white'}
                     size={32}
                  />
               </Button>
            </Animated.View>
         </HStack>

         {/* Water Logging Action Sheet */}
         <WaterLogActionsheet
            showActionsheet={showWaterSheet}
            handleClose={() => setShowWaterSheet(false)}
         />

         <CreatineLogActionsheet
            showActionsheet={showCreatineSheet}
            handleClose={() => setShowCreatineSheet(false)}
         />

         {/* Creatine reminder time modal */}
         <Modal
            isOpen={showModal}
            onClose={() => {
               setShowModal(false);
            }}
            size='md'
            closeOnOverlayClick={false}>
            <ModalBackdrop />
            <ModalContent>
               <ModalHeader>
                  <Heading
                     size='md'
                     className='text-typography-950'>
                     Lock in your daily creatine reminder!
                  </Heading>
               </ModalHeader>
               <View className='flex-row mt-4'>
                  <View className='w-1/2'>
                     <DateTimePicker
                        testID='timePicker'
                        value={date}
                        mode='time'
                        display='default'
                        onChange={onChange}
                     />
                  </View>
                  <Button
                     className='w-1/2'
                     onPress={async () => {
                        const reminderTimeString = getTimeString(date);
                        dispatch(
                           updateCreatineReminderTime({ creatineReminderTime: reminderTimeString })
                        );
                        await NotificationService.scheduleCreatineReminder(reminderTimeString);
                        setShowModal(false);
                     }}>
                     <ButtonText>Submit</ButtonText>
                  </Button>
               </View>
            </ModalContent>
         </Modal>
      </SafeAreaView>
   );
};

export default Today;
