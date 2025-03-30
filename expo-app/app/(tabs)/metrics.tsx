import { View, SafeAreaView, ScrollView, useWindowDimensions } from 'react-native'
import React from 'react'
import { Text } from '@/components/ui/text'
import { Box } from '@/components/ui/box'
import { CalendarDays } from 'lucide-react-native'
import { VStack } from '@/components/ui/vstack'
import { CartesianChart, Bar } from "victory-native";


const Metrics = () => {
  const { width, height } = useWindowDimensions();
  const fontSize = 24;

  const dummyData = [
    { x: 'Jan', y: 35 },
    { x: 'Feb', y: 42 },
    { x: 'Mar', y: 57 },
    { x: 'Apr', y: 45 },
    { x: 'May', y: 38 },
    { x: 'Jun', y: 50 }
  ];
  
  
  return (
    <SafeAreaView className="bg-background-0 h-full">
      <ScrollView className="px-[25]">
        <VStack>
          <View className="flex-row items-center pt-[10]">
            <CalendarDays color={"white"} size={32} />
            <Text className="text-[20px] font-semibold pl-[7]">History</Text>
          </View>
          <Box>
          </Box>
        </VStack>
        <View>
          <Text className="text-[32px] font-semibold pt-[10]">Metrics</Text>
          <Box className='bg-primary-0 w-full h-[168] mt-[10] rounded-[15px]'>
          <CartesianChart data={dummyData} xKey="x" yKeys={['y']}>
      {({ points, chartBounds }) => (
        <Bar
          points={points.y}
          chartBounds={chartBounds}
          color="white"
          roundedCorners={{ topLeft: 10, topRight: 10 }}
          barWidth={15} // Adjust width if necessary
          labels={{
            position: "top",
            color: "white",  // Customizing the label color only
            font: null // Using default font

          }}
        />
      )}
    </CartesianChart>
          </Box>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default Metrics