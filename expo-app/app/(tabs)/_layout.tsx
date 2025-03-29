import React from 'react'
import { Tabs } from 'expo-router'

const TabLayout = () => {
  return (
    <Tabs
    screenOptions={{
      headerShown: false, 
    }}>
        <Tabs.Screen
            name="index"
            options={{
              headerShown: false,
              tabBarLabel: 'Home',
            }}
        />
    </Tabs>
  )
}

export default TabLayout