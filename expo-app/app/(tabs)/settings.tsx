import { View, Text, SafeAreaView } from 'react-native'
import React from 'react'
import { Button, ButtonText } from "@/components/ui/button"
import { supabase } from '@/lib/supabase'


const Settings = () => {
  return (
    <SafeAreaView>
      <Text>settings</Text>
      <Button onPress={() => supabase.auth.signOut()}>
        <ButtonText>Log Out</ButtonText>
      </Button>
    </SafeAreaView>
  )
}

export default Settings