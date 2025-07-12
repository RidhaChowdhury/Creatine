import React, { useEffect, useState } from 'react';
import {
	Alert,
	StyleSheet,
	TextInput,
	View,
	TouchableOpacity,
	SafeAreaView,
	Platform,
	Keyboard
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import { Input, InputField } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

export default function SignUP() {
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

	async function signUpWithEmail() {
		setLoading(true);
		const { error } = await supabase.auth.signUp({
			email: email,
			password: password
		});

		if (error) Alert.alert('Sign Up Error', error.message);
		setLoading(false);
	}

	return (
		<SafeAreaView className='h-full bg-background-0 flex'>
			<View
				className='flex-1 justify-center mt-[-25%] p-[30]'
				style={{ paddingBottom: keyboardHeight }}>
				<Text className='text-[30px] font-bold pb-[5]'>Create an account</Text>
				<View>
					<TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
						<View className='flex-row'>
							<Text className='text-[14px] pb-[20]'>Already have an account?</Text>
							<Text className='text-[14px] pb-[20] ml-[5] font-bold'>Login</Text>
						</View>
					</TouchableOpacity>
				</View>
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

				<Button onPress={() => signUpWithEmail()} className='bg-primary-0 h-[40] mt-[20]'>
					<Text className='text-white text-[16px] font-semibold'>Sign Up</Text>
				</Button>
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		marginTop: 40,
		padding: 12
	},
	verticallySpaced: {
		paddingTop: 4,
		paddingBottom: 4,
		alignSelf: 'stretch'
	},
	mt20: {
		marginTop: 20
	},
	buttonContainer: {
		backgroundColor: '#000968',
		borderRadius: 10,
		paddingVertical: 10,
		paddingHorizontal: 12,
		margin: 8
	},
	buttonText: {
		fontSize: 18,
		color: '#fff',
		fontWeight: 'bold',
		alignSelf: 'center',
		textTransform: 'uppercase'
	},
	textInput: {
		borderColor: '#000968',
		borderRadius: 4,
		borderStyle: 'solid',
		borderWidth: 1,
		padding: 12,
		margin: 8
	}
});
