import React from 'react'
import { Tabs } from 'expo-router'
import {CalendarFold} from 'lucide-react-native';

const TabLayout = () => {
  return (
    <Tabs
    screenOptions={{
      headerShown: false, 
      tabBarShowLabel: false 
    }}>
        <Tabs.Screen
            name="index"
            options={{
              headerShown: false,
              tabBarIcon: ({ focused }) => (
                <CalendarFold size={24} color={focused ? 'accent' : 'gray'} />
              )
            }}
        />
    </Tabs>
  )
}

export default TabLayout