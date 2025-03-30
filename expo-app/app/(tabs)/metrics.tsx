import { View, SafeAreaView, ScrollView } from 'react-native'
import React from 'react'
import { Text } from '@/components/ui/text'
import { Box } from '@/components/ui/box'
import { CalendarDays } from 'lucide-react-native'


const Metrics = () => {
  return (
    <SafeAreaView className="bg-background-0 h-full">
      <ScrollView className="px-[15]">
        <View className="flex-row items-center pt-[10]">
          <CalendarDays color={"white"} size={32} />
          <Text className="text-[20px] font-semibold pl-[7]">History</Text>
          <Box>

          </Box>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default Metrics