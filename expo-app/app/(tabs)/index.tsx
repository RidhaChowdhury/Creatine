import { View, SafeAreaView, TouchableOpacity } from "react-native";
import React, { useState, useEffect, useCallback, useContext } from "react";
import { Text } from "@/components/ui/text";
import { Fab } from "@/components/ui/fab";
import { GlassWater } from "lucide-react-native";
import CreatineScoopIcon from "@/components/CreatineScoop";
import { supabase } from "@/lib/supabase";
import { WaterLogActionsheet } from "@/components/WaterLogActionSheet";
import { CreatineLogActionsheet } from "@/components/CreatineLogActionSheet";
import { useAuth } from "@/context/authContext"; // Custom hook to get the user ID
import { HStack } from "@/components/ui/hstack";
import { Button } from "@/components/ui/button";
import { WaveBackground } from "@/components/WaveBackground";
import ConfettiCannon from 'react-native-confetti-cannon';
import Animated, { FadeIn, FadeInDown, FadeOutDown } from 'react-native-reanimated'
import { useFocusEffect } from "expo-router";
import * as Haptics from 'expo-haptics';


import { RefreshContext, RefreshContextType } from "@/context/refreshContext";

const Today = () => {
  const [creatineAmount, setCreatineAmount] = useState(0);
  const [waterAmount, setWaterAmount] = useState(0);
  const [dailyGoal, setDailyGoal] = useState({
    creatine: 5.0,
    water: 150,
  });
  const [showWaterSheet, setShowWaterSheet] = useState(false);
  const [showCreatineSheet, setShowCreatineSheet] = useState(false);

  // const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { refresh, refreshTrigger }  = useContext<RefreshContextType>(RefreshContext);
  const { user } = useAuth();

  const [animationKey, setAnimationKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setAnimationKey((prevKey) => prevKey + 1); // Change key on every focus
    }, [])
  );


  const fetchData = useCallback(async () => {
    const today = new Date().toISOString().split("T")[0];
    if (!user?.id) return;

    // Fetch creatine logs
    const { data: creatineData } = await supabase
      .from("creatine_logs")
      .select("dose_grams")
      .eq("user_id", user.id)
      .gte("taken_at", `${today}T00:00:00`)
      .lte("taken_at", `${today}T23:59:59`);

    // Fetch water logs
    const { data: waterData } = await supabase
      .from("water_logs")
      .select("volume_floz")
      .eq("user_id", user.id)
      .gte("logged_at", `${today}T00:00:00`)
      .lte("logged_at", `${today}T23:59:59`);

    const { data: userSettings } = await supabase
      .from("user_settings")
      .select("creatine_goal, water_goal")
      .eq("user_id", user.id)
      .single();

    if (userSettings) {
      const { creatine_goal, water_goal } = userSettings;
      setDailyGoal({
        creatine: creatine_goal,
        water: water_goal,
      });
    }
    if (creatineData) {
      const total = creatineData.reduce((sum, log) => sum + log.dose_grams, 0);
      setCreatineAmount(Number(total.toFixed(1)));
    }
    if (waterData) {
      const total = waterData.reduce((sum, log) => sum + log.volume_floz, 0);
      setWaterAmount(total);
    }
  }, []);

  // Fetch all initial data
  useEffect(() => {
    fetchData();
  }, [fetchData, refreshTrigger]);


  useEffect(() => {
    if (waterAmount >= dailyGoal.water) {
      const triggerHaptic = async () => {
        for (let i = 0; i < 3; i++) {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          await new Promise(resolve => setTimeout(resolve, 100)); // Small delay between buzzes
        }
      };
      triggerHaptic();
    }
  }, [waterAmount, dailyGoal.water]);


  return (
    <SafeAreaView className="bg-background-0 flex-1">
      <WaveBackground
        progressPercent={waterAmount / dailyGoal.water}
        offsetPercentage={2}
        // waveColor="rgba(100, 200, 255, 0.6)"
      />

      {waterAmount >= dailyGoal.water && (
        <ConfettiCannon
          count={100}
          origin={{x: -10, y: 0}}
          autoStartDelay={600}
          fadeOut={true}
        />
      )}

      {/* Creatine Section */}
      <View className="absolute top-20 left-5">
        <View className="flex-row items-end justify-end gap-1">
          <Text className="text-3xl font-bold text-white">
            {creatineAmount}
          </Text>
          <Text className="text-xl text-neutral-300 pb-1">g</Text>
        </View>
      </View>
      {/* Water Section */}
      <View className="flex-1 justify-center items-center">
        <View className="flex-row items-end gap-2">
          <Text className="text-5xl font-bold text-white">{waterAmount}</Text>
          <Text className="text-xl text-neutral-300 pb-1">oz</Text>
        </View>
      </View>

      <HStack className="absolute bottom-4 right-4" space="xl">
        {/* Creatine Button (left) */}
        <Animated.View
          key={animationKey}
          entering={FadeInDown.duration(1000).delay(100).springify().damping(12)}
        >
          <Button
            size="lg"
            className="bg-primary-0 rounded-full w-20 h-20"
            onPress={() => setShowCreatineSheet(true)}
          >
          <CreatineScoopIcon color={"white"} size={50} />
          </Button>
        </Animated.View>

        {/* Water Button (right) */}
        <Animated.View
          key={`water-${animationKey}`}
          entering={FadeInDown.duration(1000).delay(100).springify().damping(12)}
        >
          <Button
            size="lg"
            className="bg-primary-0 rounded-full w-20 h-20"
            onPress={() => setShowWaterSheet(true)}
          >
            <GlassWater color={"white"} size={32} />
          </Button>
        </Animated.View>
      </HStack>

      {/* Water Logging Action Sheet */}
      <WaterLogActionsheet
        showActionsheet={showWaterSheet}
        handleClose={() => setShowWaterSheet(false)}
        onLog={() => {
          refresh('water');
        }}
      />

      <CreatineLogActionsheet
        showActionsheet={showCreatineSheet}
        handleClose={() => setShowCreatineSheet(false)}
        onLog={() => {
          refresh('creatine');
        }}
      />
    </SafeAreaView>
  );
};

export default Today;
