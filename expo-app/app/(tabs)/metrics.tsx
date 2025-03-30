import {
  View,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import React, { useState, useEffect } from "react";
import { Text } from "@/components/ui/text";
import { Box } from "@/components/ui/box";
import { CalendarDays } from "lucide-react-native";
import { VStack } from "@/components/ui/vstack";
import HeatCalendar from "@/components/HeatCalendar";
import { supabase } from "@/lib/supabase"; // Make sure you have this configured
import CreatineDay from "@/components/CreatineDay";

type CommitData = {
  date: string;
  count: number;
};

const Metrics = () => {
  const [commitData, setCommitData] = useState<CommitData[]>([]);
  const [loading, setLoading] = useState(true);
  const [daysToShow] = useState(28); // You can make this configurable
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
        console.log(`Fetched ${formattedData.length} days of commit data`); // Debug log to check the number of days fetched
        console.log("Commit Data:", formattedData);
      } catch (error) {
        console.error("Error fetching creatine data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCreatineData();
  }, [daysToShow]);

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
        </VStack>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Metrics;