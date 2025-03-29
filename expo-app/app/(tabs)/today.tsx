import { View, SafeAreaView } from "react-native";
import React, { useState, useEffect } from "react";
import { Text } from "@/components/ui/text"
import { supabase } from "@/lib/supabase";

const Today = () => {
    const [creatineAmount, setCreatineAmount] = useState(0);
    const [waterAmount, setWaterAmount] = useState(0);

    useEffect(() => {
    const fetchTodayData = async () => {
        const { data } = await supabase
        .from("water_logs")
        .select("volume_floz")
        .eq("date", new Date().toISOString().split("T")[0]);
        if (data) setWaterAmount(data[0]?.volume_floz);
    };
    fetchTodayData();
    }, []);

    return (
    <SafeAreaView className="bg-background-0 flex-1">
        {/* Creatine display (top left) */}
        <View className="absolute top-20 left-5">
        <Text className="text-3xl font-bold text-white">
            {creatineAmount}g
        </Text>
        <Text className="text-sm text-neutral">Creatine</Text>
        </View>

        {/* Water display (center) */}
        <View className="flex-1 justify-center items-center">
        <Text className="text-5xl font-bold text-white">
            {waterAmount}oz
        </Text>
        <Text className="text-lg text-neutral">Water</Text>
        </View>
    </SafeAreaView>
    );
};

export default Today;
