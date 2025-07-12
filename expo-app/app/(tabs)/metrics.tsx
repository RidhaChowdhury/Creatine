import {
  View,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import React, { useState, useEffect, useContext } from "react";
import { Text } from "@/components/ui/text";
import { Box } from "@/components/ui/box";
import { CalendarDays, ChartPie, Flame } from "lucide-react-native";
import { VStack } from "@/components/ui/vstack";
import HeatCalendar from "@/components/HeatCalendar";
import { supabase } from "@/lib/supabase";
import { Pie, PolarChart } from "victory-native";
import { Divider } from "@/components/ui/divider";
import CreatineDay from "@/components/CreatineDay";
import { CreatineHistory } from "@/components/CreatineHistory";
import { WaterHistory } from "@/components/WaterHistory";
import { Button } from "@/components/ui/button";
import { GlassWater } from "lucide-react-native";
import CreatineScoopIcon from "@/components/CreatineScoop";

const Metrics = () => { 
  const [openPage, setOpenPage] = useState<"creatine" | "water">("creatine");
  return (
    <SafeAreaView className="bg-background-0 h-full">
      <ScrollView showsVerticalScrollIndicator={false} className="px-[15]">
        <View className="flex-row justify-between">
          <View className="flex-row items-center pt-[10] px-[15]">
            <CalendarDays color={"white"} size={32} />
            <Text className="text-[20px] font-semibold pl-[7]">{openPage === "creatine" ? 'Creatine' : 'Water' } History</Text>
          </View>
          <Button className="bg-primary-0 rounded-full px-4 py-4 mt-3 w-12 h-12" onPress={() => setOpenPage(openPage === "creatine" ? "water" : "creatine")}>
            {openPage === "creatine" ? (
              <GlassWater color={"white"} size={16} />
            ) : (
              <CreatineScoopIcon color={"white"} size={25} />
            )}
          </Button>
        </View>
        <View className="mb-4">
          {openPage === "creatine" ? <CreatineHistory /> : <WaterHistory />}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Metrics;