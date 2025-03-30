import { View, SafeAreaView, ScrollView, useWindowDimensions } from 'react-native'
import React from 'react'
import { Text } from '@/components/ui/text'
import { Box } from '@/components/ui/box'
import { CalendarDays } from 'lucide-react-native'
import { VStack } from '@/components/ui/vstack'

const Metrics = () => {
  const { width, height } = useWindowDimensions();
  
  return (
    <SafeAreaView className="bg-background-0 h-full">
      <ScrollView className="px-[15]">
        <VStack>
          <View className="flex-row items-center pt-[10]">
            <CalendarDays color={"white"} size={32} />
            <Text className="text-[20px] font-semibold pl-[7]">History</Text>
          </View>
          <Box>
          </Box>
        </VStack>
      </ScrollView>
    </SafeAreaView>
  );
}

export default Metrics