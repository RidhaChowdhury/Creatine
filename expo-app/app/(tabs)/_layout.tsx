import React from 'react'
import { Tabs } from 'expo-router'
import {CalendarFold, ChartNoAxesColumnIncreasing, Settings} from 'lucide-react-native';
import { View } from 'react-native';

const TabLayout = () => {
  return (
    <Tabs
    screenOptions={{
      headerShown: false, 
      tabBarShowLabel: false,
      tabBarStyle: {
        backgroundColor: '#07070A',
        borderTopColor: '#555A5F',
        height: 75
      },
      tabBarItemStyle: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 8
      }
    }}>
        <Tabs.Screen
            name="index"
            options={{
              headerShown: false,
              tabBarIcon: ({ focused }) => (
                <CalendarFold size={26} color={focused ? 'white' : '#555A5F' } />
              )
            }}
        />

        <Tabs.Screen
            name="metrics"
            options={{
              headerShown: false,
              tabBarIcon: ({ focused }) => (
                <ChartNoAxesColumnIncreasing size={26} color={focused ? 'white' : '#555A5F' } />
              )
            }}
        />

        <Tabs.Screen
            name="settings"
            options={{
              headerShown: false,
              tabBarIcon: ({ focused }) => (
                <Settings size={26} color={focused ? 'white' : '#555A5F' } />
              )
            }}
        />
    </Tabs>
  )
}

export default TabLayout