import { View, SafeAreaView, TouchableOpacity } from "react-native";
import React, { useState, useEffect } from "react";
import { Text } from "@/components/ui/text";
import { supabase } from "@/lib/supabase";

const Today = () => {
  const [creatineAmount, setCreatineAmount] = useState(0);
  const [waterAmount, setWaterAmount] = useState(0);
  const [dailyGoal, setDailyGoal] = useState({
    creatine: 5.0,
    water: 3000,
  });

  // Fetch all initial data
  useEffect(() => {
    const fetchData = async () => {
      const today = new Date().toISOString().split("T")[0];
      const userId = (await supabase.auth.getUser()).data.user?.id;

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

  const addCreatineIntake = async (grams: number) => {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) return;

    try {
      // Optimistic UI update
      setCreatineAmount((prev) => Number((prev + grams).toFixed(1)));

      // Insert into Supabase
      const { error } = await supabase.from("creatine_logs").insert([
        {
          user_id: userId,
          dose_grams: grams,
          form: "monohydrate", // Default form
          taken_at: new Date().toISOString(),
        },
      ]);

      if (error) {
        // Rollback on error
        setCreatineAmount((prev) => Number((prev - grams).toFixed(1)));
        console.error("Creatine log error:", error);
      }
    } catch (err) {
      console.error("Unexpected error:", err);
    }
  };

  return (
    <SafeAreaView className="bg-background-0 flex-1">
      {/* Creatine Section */}
      <View className="absolute top-20 left-5">
        <View className="flex-row items-end gap-2">
          <Text className="text-3xl font-bold text-white">
            {creatineAmount}g
          </Text>
          <Text className="text-sm text-neutral-300 pb-1">
            /{dailyGoal.creatine}g
          </Text>
        </View>
        <Text className="text-sm text-neutral-400 mb-2">Creatine</Text>

        <TouchableOpacity
          className="bg-primary px-4 py-2 rounded-lg w-32"
          onPress={() => addCreatineIntake(5)}
        >
          <Text className="text-white text-center font-medium">+5g</Text>
        </TouchableOpacity>
      </View>

      {/* Water Section */}
      <View className="flex-1 justify-center items-center">
        <View className="flex-row items-end gap-2">
          <Text className="text-5xl font-bold text-white">{waterAmount}</Text>
          <Text className="text-xl text-neutral-300 pb-1">
            /{dailyGoal.water}
          </Text>
        </View>
        <Text className="text-lg text-neutral-400">Water (fl oz)</Text>
      </View>
    </SafeAreaView>
  );
};

export default Today;
