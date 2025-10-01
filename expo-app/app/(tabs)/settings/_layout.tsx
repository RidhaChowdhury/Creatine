import { Stack } from 'expo-router';

export default function SettingsLayout() {
   return (
      <Stack>
         <Stack.Screen
            name='index'
            options={{ headerShown: false }}
         />
         <Stack.Screen
            name='about'
            options={{ headerShown: false }}
         />
         <Stack.Screen
            name='account'
            options={{ headerShown: false }}
         />
         <Stack.Screen
            name='contact'
            options={{ headerShown: false }}
         />
         <Stack.Screen
            name='manageSubscription'
            options={{ headerShown: false }}
         />
         <Stack.Screen
            name='notifications'
            options={{ headerShown: false }}
         />
         <Stack.Screen
            name='profile'
            options={{ headerShown: false }}
         />
         <Stack.Screen
            name='units'
            options={{ headerShown: false }}
         />
      </Stack>
   );
}
