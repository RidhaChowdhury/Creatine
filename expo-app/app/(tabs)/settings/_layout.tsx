import { Stack } from 'expo-router';

export default function SettingsLayout() {
   return (
      <Stack
         screenOptions={{
            headerShown: true,
            headerStyle: { backgroundColor: '#07070a' },
            headerTintColor: '#fff',
            headerTitleAlign: 'center',
            headerBackButtonDisplayMode: 'minimal'
         }}>
         <Stack.Screen
            name='index'
            options={{ headerShown: false }}
         />
         <Stack.Screen
            name='about'
            options={{  }}
         />
         <Stack.Screen
            name='account'
            options={{  }}
         />
         <Stack.Screen
            name='contact'
            options={{  }}
         />
         <Stack.Screen
            name='manageSubscription'
            options={{  }}
         />
         <Stack.Screen
            name='notifications'
            options={{  }}
         />
         <Stack.Screen
            name='profile'
            options={{
              headerTitle: 'Edit Profile' 
            }}
         />
         <Stack.Screen
            name='units'
            options={{  }}
         />
      </Stack>
   );
}
