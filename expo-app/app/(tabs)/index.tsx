import { View, SafeAreaView, TouchableOpacity } from "react-native";
import React, { useState, useEffect } from "react";
import { Text } from "@/components/ui/text";
import { Fab } from "@/components/ui/fab";
import { GlassWater } from "lucide-react-native";
import CreatineScoopIcon from "@/components/CreatineScoop";
import { supabase } from "@/lib/supabase";
import { WaterLogActionsheet } from "@/components/WaterLogActionSheet";
import { useAuth } from "@/context/authContext"; // Custom hook to get the user ID
import { HStack } from "@/components/ui/hstack";
import { Button } from "@/components/ui/button";


const Today = () => {
  const [creatineAmount, setCreatineAmount] = useState(0);
  const [waterAmount, setWaterAmount] = useState(0);
  const [dailyGoal, setDailyGoal] = useState({
    creatine: 5.0,
    water: 150,
  });
  const [showSheet, setShowSheet] = useState(false);
  const handleClose = () => setShowSheet(false);

  // Fetch all initial data
  useEffect(() => {
    const fetchData = async () => {
      const today = new Date().toISOString().split("T")[0];
      const {user} = useAuth();
      const userId = user?.id;

      if (!userId) return;

      // Fetch today's creatine logs
      const { data: creatineData } = await supabase
        .from("creatine_logs")
        .select("dose_grams")
        .eq("user_id", userId)
        .gte("taken_at", `${today}T00:00:00`)
        .lte("taken_at", `${today}T23:59:59`);

      if (creatineData) {
        const total = creatineData.reduce(
          (sum, log) => sum + log.dose_grams,
          0
        );
        setCreatineAmount(Number(total.toFixed(1)));
      }

      // Fetch today's water logs
      const { data: waterData } = await supabase
        .from("water_logs")
        .select("volume_floz")
        .eq("user_id", userId)
        .gte("logged_at", `${today}T00:00:00`)
        .lte("logged_at", `${today}T23:59:59`);

      if (waterData) {
        const total = waterData.reduce((sum, log) => sum + log.volume_floz, 0);
        setWaterAmount(total);
      }

      // Fetch user goals
      const { data: goalsData } = await supabase
        .from("user_goals")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (goalsData) {
        setDailyGoal({
          creatine: goalsData.daily_creatine_grams,
          water: goalsData.daily_water_floz,
        });
      }
    };

    fetchData();
  }, []);

  return (
    <SafeAreaView className="bg-background-0 flex-1">
      {/* Creatine Section */}
      <View className="absolute top-20 left-5">
        <Text className="text-3xl font-bold text-white">{creatineAmount}g</Text>
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
        <Button
          size="lg"
          className="bg-primary-0 rounded-full w-20 h-20"
          onPress={() => setShowSheet(true)}
        >
          <CreatineScoopIcon color={"white"} size={50} />
        </Button>

        {/* Water Button (right) */}
        <Button
          size="lg"
          className="bg-primary-0 rounded-full w-20 h-20"
          onPress={() => setShowSheet(true)}
        >
          <GlassWater color={"white"} size={32} />
        </Button>
      </HStack>

      {/* Water Logging Action Sheet */}
      <WaterLogActionsheet
        showActionsheet={showSheet}
        handleClose={() => setShowSheet(false)}
        onLog={() => {}}
      />
    </SafeAreaView>
  );
};

export default Today;
