import React, { useEffect, useState } from 'react';
import {
	Alert,
	StyleSheet,
	View,
	TouchableOpacity,
	SafeAreaView,
	Platform,
	Keyboard
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import { Input, InputField } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
export default function Login() {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [loading, setLoading] = useState(false);
	const [keyboardHeight, setKeyboardHeight] = useState(0);

	useEffect(() => {
		const showSubscription = Keyboard.addListener(
			Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
			(e) => setKeyboardHeight(e.endCoordinates.height)
		);
		const hideSubscription = Keyboard.addListener(
			Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
			() => setKeyboardHeight(0)
		);

		return () => {
			showSubscription.remove();
			hideSubscription.remove();
		};
	}, []);

	async function signInWithEmail() {
		setLoading(true);
		const { error } = await supabase.auth.signInWithPassword({
			email: email,
			password: password
		});

		if (error) Alert.alert('Sign In Error', error.message);
		setLoading(false);
	}

	return (
		<SafeAreaView className='h-full bg-background-0 flex'>
			<View
				className='flex-1 justify-center mt-[-20%] p-[30]'
				style={{ paddingBottom: keyboardHeight }}>
				<Text className='text-[30px] font-bold pb-[5]'>Login to your account</Text>
				<View>
					<TouchableOpacity onPress={() => router.replace('/(auth)/sign-up')}>
						<View className='flex-row'>
							<Text className='text-[14px] pb-[20]'>Don't have an account?</Text>
							<Text className='text-[14px] pb-[20] ml-[5] font-bold'>Sign up</Text>
						</View>
					</TouchableOpacity>
				</View>
				<View>
					<View>
						<Text className='text-[14px] font-semibold pb-[5]'>Email</Text>
						<Input className='h-[40]'>
							<InputField
								placeholder='email@website.com'
								onChangeText={(text: string) => setEmail(text)}></InputField>
						</Input>
					</View>
					<View className='pb-4'>
						<Text className='text-[14px] font-semibold pb-[5] pt-[20]'>Password</Text>
						<Input className='h-[40]'>
							<InputField
								secureTextEntry={true}
								placeholder='********'
								onChangeText={(text: string) => setPassword(text)}></InputField>
						</Input>
					</View>
				</View>
				<View className='flex flex-row justify-end mt-2'>
					<TouchableOpacity className='flex-end'>
						<Text>Forgot password?</Text>
					</TouchableOpacity>
				</View>
				<Button onPress={() => signInWithEmail()} className='bg-primary-0 h-[40] mt-[20]'>
					<Text className='text-white text-[16px] font-semibold'>Login</Text>
				</Button>
			</View>
		</SafeAreaView>
	);
}
