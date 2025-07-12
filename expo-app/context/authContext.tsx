import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { router } from 'expo-router';
import { User } from '@supabase/supabase-js'; // Import types

type AuthContextType = {
	user: User | null;
	setUser: Function;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
	const [user, setUser] = useState<User | null>(null);

	const checkUserSettings = async (userId: string) => {
		const { data, error } = await supabase
			.from('user_settings')
			.select('*')
			.eq('user_id', userId)
			.single(); // Assuming each user has at most one settings record

		if (error) {
			// console.error('Error fetching user settings:', error);
			return false; // Return false if there's an error, indicating no settings
		}

		return !!data; // Return true if settings exist, false otherwise
	};

	useEffect(() => {
		const loadSession = async () => {
			const {
				data: { session }
			} = await supabase.auth.getSession();
			if (session?.user) {
				setUser(session.user);
				const hasSettings = await checkUserSettings(session.user.id); // Await the result here
				router.replace(hasSettings ? '/(tabs)' : '/(auth)/onboarding');
			}
		};

		loadSession(); // Initialize session check on component mount

		const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
			if (session?.user) {
				setUser(session.user);
				const hasSettings = await checkUserSettings(session.user.id); // Await the result here
				router.replace(hasSettings ? '/(tabs)' : '/(auth)/onboarding');
			} else {
				setUser(null);
				router.replace('/(auth)/login');
			}
		});

		return () => {
			authListener.subscription.unsubscribe();
		};
	}, []);

	const contextValue: AuthContextType = {
		user,
		setUser
	};

	return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

// Custom hook to use the auth context
export const useAuth = () => {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error('useAuth must be used within an AuthProvider');
	}
	return context;
};
