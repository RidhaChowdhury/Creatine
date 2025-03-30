import {
  View,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import React, { useState, useEffect } from "react";
import { Text } from "@/components/ui/text";
import { Box } from "@/components/ui/box";
import { CalendarDays, ChartPie, Flame } from "lucide-react-native";
import { VStack } from "@/components/ui/vstack";
import HeatCalendar from "@/components/HeatCalendar";
import { supabase } from "@/lib/supabase";
import { Pie, PolarChart } from "victory-native";
import { HStack } from "@/components/ui/hstack";
import { Divider } from "@/components/ui/divider";
import CreatineDay from "@/components/CreatineDay";

type CommitData = {
  date: string;
  count: number;
};

type DistributionData = {
  form: string;
  count: number;
  color: string;
}

const Metrics = () => {
  const [commitData, setCommitData] = useState<CommitData[]>([]);
  const [loading, setLoading] = useState(true);
  const [daysToShow] = useState(28); // You can make this configurable

  const [distributionData, setDistributionData] = useState<DistributionData[]>([]);

  const [consistencyData, setConsistencyData] = useState<any>(0);
  const[streakData, setStreakData] = useState<number>(0);
  const [daysLoggedData, setDaysLoggedData] = useState<number>(0);
  const [selectedDay, setSelectedDay] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => {
    const fetchCreatineData = async () => {
      try {
        // Get current user
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();
        if (authError || !user)
          throw authError || new Error("No user logged in");

        // Call the Postgres function
        const { data, error } = await supabase.rpc(
          "get_creatine_heatmap_data",
          {
            user_uuid: user.id,
            days_back: daysToShow,
          }
        );

        if (error) throw error;

        // Transform to CommitData format
        const formattedData = data.map((item: any) => ({
          date: item.date,
          count: item.count,
        }));

        setCommitData(formattedData);
      } catch (error) {
        console.error("Error fetching creatine data:", error);
      } finally {
        setLoading(false);
      }
    };

    const fetchCreatineForms = async () => {
      try {
        // Get current user
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();
        if (authError || !user)
          throw authError || new Error("No user logged in");

        // Call the Postgres function to get creatine forms data
        const { data, error } = await supabase.rpc(
          "get_creatine_form_distribution",
          { user_uuid: user.id }
        );

        if (error) throw error;
        // Add random colors to the data and set the distribution data
        const distribution: DistributionData[] = data.map((item: any) => {
          // Generate a random color for each type
          const color = generateRandomColor();
          return {
            form: item.form,
            count: item.count,
            color: color, // Use the generated random color
          };
        });
        setDistributionData(distribution);
        console.log(distribution);
      } catch (error) {
        console.error("Error fetching creatine forms data:", error);
      }
    }

    const fetchCreatineConsistency = async () => {
      try {
        // Get current user
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();
        if (authError || !user)
          throw authError || new Error("No user logged in");

        // Call the Postgres function to get creatine consistency data
        const { data, error } = await supabase.rpc("get_creatine_consistency", {
          user_uuid: user.id,
        });

        if (error) throw error;
        // Process the consistency data if needed
        setConsistencyData(data ? data[0].consistency_percentage : 0); // Assuming the response has a 'consistency' field
      } catch (error) {
        console.error("Error fetching creatine consistency data:", error);
      }
    }

    const fetchStreak = async () => {
      try {
        // Get current user
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();
        if (authError || !user)
          throw authError || new Error("No user logged in");

        // Call the Postgres function to get streak data
        const { data, error } = await supabase.rpc("get_creatine_streak", {
          user_uuid: user.id,
        });

        if (error) throw error;
        // Process the streak data if needed
        setStreakData(data ? data[0].streak_days : 0); // Assuming the response has a 'streak_count' field
      }
      catch (error) {
        console.error("Error fetching creatine streak data:", error);
      }
    }

    const fetchDaysLogged = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const { data, error } = await supabase.rpc("get_creatine_days_logged", {
          user_uuid: user?.id,
        });

        if (error) throw error;

        // Properly handle the array response
        const daysLogged = data?.[0]?.days_logged ?? 0;
        setDaysLoggedData(daysLogged);

        // This will log correctly
        console.log("Processed days logged:", daysLogged);
      } catch (error) {
        console.error("Error fetching days logged:", error);
        setDaysLoggedData(0);
      }
    };

    fetchCreatineData();
    fetchCreatineForms();
    fetchCreatineConsistency();
    fetchStreak();
    fetchDaysLogged();
  }, [daysToShow]);

  function generateRandomColor(): string {
    // Generating a random number between 0 and 0xFFFFFF
    const randomColor = Math.floor(Math.random() * 0xffffff);
    // Converting the number to a hexadecimal string and padding with zeros
    return `#${randomColor.toString(16).padStart(6, "0")}`;
  }

  return (
    <SafeAreaView className="bg-background-0 h-full">
      <ScrollView className="px-[15]">
        <VStack>
          <View className="flex-row items-center pt-[10]">
            <CalendarDays color={"white"} size={32} />
            <Text className="text-[20px] font-semibold pl-[7]">History</Text>
          </View>
          <Box className="mt-4 bg-primary-0 rounded-[15px]">
            {loading ? (
              <View className="py-8">
                <ActivityIndicator size="large" color="#ffffff" />
              </View>
            ) : (
              <HeatCalendar
                data={commitData}
                endDate={new Date().toISOString().split("T")[0]}
                numDays={daysToShow}
                onDayPress={(date) => setSelectedDay(date)}
              />
            )}
            <CreatineDay day={selectedDay} />
          </Box>
          <View className="flex-row items-center pt-[20]">
            <ChartPie color={"white"} size={32} />
            <Text className="text-[20px] font-semibold pl-[7]">Metrics</Text>
          </View>
          <Box className="mt-4 bg-primary-0 rounded-[15px] p-4">
            {distributionData.length > 0 ? (
              <View
                className="flex-row items-center justify-start"
                style={{ height: 150 }}
              >
                {/* Chart container with explicit dimensions */}
                <View className="w-3/5">
                  {/* Maintain square aspect ratio */}
                  <PolarChart
                    data={distributionData}
                    labelKey="form"
                    valueKey="count"
                    colorKey="color"
                  >
                    <Pie.Chart innerRadius={"50%"} size={125} />
                  </PolarChart>
                </View>

                {/* Legend - takes remaining space */}
                <View className="w-2/5 justify-center">
                  {distributionData.map((item, index) => (
                    <View key={index} className="flex-row items-center mb-2">
                      <View
                        className="w-3 h-3 rounded-full mr-2"
                        style={{ backgroundColor: item.color }}
                      />
                      <Text className="text-foreground text-sm">
                        <Text className="font-medium">
                          {item.form} ({item.count})
                        </Text>
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <Text className="text-center py-8 text-foreground">
                No creatine form data available
              </Text>
            )}
          </Box>

          <Box className="bg-primary-0 rounded-[15px] p-6 mt-4">
            <View className="flex-row items-center justify-between">
              {/* First Consistency */}
              <View className="flex-1 items-center">
                <Text className="text-sm mb-1">Consistency</Text>
                <Text className="text-xl font-bold">
                  {consistencyData ? `${consistencyData}%` : "0%"}
                </Text>
              </View>

              <Divider orientation="vertical" />

              {/* Streak - Centered with icon and number */}
              <View className="flex-1 items-center">
                <Text className="text-sm mb-1">Streak</Text>
                <View className="flex-row items-center justify-center">
                  <Flame color="white" size={18} className="mr-1" />
                  <Text className="text-xl font-bold">{streakData ?? 0}</Text>
                </View>
              </View>

              <Divider orientation="vertical" />

              {/* Second Metric - Replace with something different */}
              <View className="flex-1 items-center">
                <Text className="text-sm mb-1">Days Logged</Text>
                <Text className="text-xl font-bold">{daysLoggedData}</Text>
              </View>
            </View>
          </Box>

          <Box className="bg-primary-0 rounded-[15px] p-6 mt-4">
            <View className="flex-row items-center justify-between">
              {/* First Consistency */}
              <View className="flex-1 items-center">
                <Text className="text-md mb-1">Saturation</Text>
                <Text className="text-2xl font-bold">54%</Text>
              </View>

              <Divider orientation="vertical" />

              {/* Streak - Centered with icon and number */}
              <View className="flex-1 items-center">
                <Text className="text-md mb-1">Till Saturation</Text>
                <Text className="text-2xl font-bold">18 days</Text>
              </View>
            </View>
          </Box>
        </VStack>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Metrics;