import React, { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Button, Input, Text, XStack, YStack } from 'tamagui';
import { supabase, checkSupabaseConnection } from '@/lib/supabase';
import { recoveryRedirect } from '@/lib/authLinks';

const colors = { background: '#0c0c0c', text: '#e9e9e9', muted: '#a0a0a0', blue: '#398eff', line: '#353535', error: '#ff8585' } as const;

export default function AuthScreen({ signUp = false }: { signUp?: boolean }) {
   const [email, setEmail] = useState('');
   const [password, setPassword] = useState('');
   const [busy, setBusy] = useState(false);
   const [error, setError] = useState('');
   const [message, setMessage] = useState('');
   const [connection, setConnection] = useState('Checking connection…');
   const [attempt, setAttempt] = useState(0);

   useEffect(() => {
      let active = true;
      setConnection('Checking connection…');
      checkSupabaseConnection().then(() => {
         if (active) setConnection('');
      }).catch((err) => {
         if (active) setConnection(err.message || 'Unable to connect.');
      });
      return () => { active = false; };
   }, [attempt]);

   const submit = async () => {
      if (!supabase || busy) return;
      setError(''); setMessage(''); setBusy(true);
      try {
         const cleanEmail = email.trim();
         if (!cleanEmail || !password) throw new Error('Enter your email and password.');
         const { data, error: authError } = signUp
            ? await supabase.auth.signUp({ email: cleanEmail, password, options: { emailRedirectTo: recoveryRedirect().replace('reset-password','') } })
            : await supabase.auth.signInWithPassword({ email: cleanEmail, password });
         if (authError) throw authError;
         if (signUp && !data.session) setMessage('Check your email to confirm your account, then log in.');
      } catch (err) {
         setError((err as Error).message || 'Unable to sign in. Please try again.');
      } finally { setBusy(false); }
   };

   const fieldLabel = { color: colors.muted, fontFamily: 'IBMPlexMono', fontSize: 11, letterSpacing: 0.7 } as const;
   const fieldStyle = { height: 50, borderColor: colors.line, borderRadius: 2, backgroundColor: 'transparent', color: colors.text, fontFamily: 'Archivo', fontSize: 15, paddingHorizontal: 14 } as const;

   return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <YStack flex={1} justifyContent="center" paddingHorizontal={24} paddingVertical={32}>
         <YStack width="100%" maxWidth={430} alignSelf="center" gap={22}>
            <YStack gap={8} marginBottom={10}>
               <Text color={colors.text} fontFamily="$body" fontSize={27} fontWeight="800" letterSpacing={-1}>drops.</Text>
               <Text color={colors.text} fontFamily="$heading" fontSize={38} fontWeight="600" lineHeight={40}>
                  {signUp ? 'Create an account' : 'Login to your account'}
               </Text>
            </YStack>
            {connection ? <YStack borderLeftWidth={2} borderLeftColor={colors.blue} paddingLeft={12} gap={6}>
               <Text color={colors.muted} fontFamily="$body" fontSize={13} role="alert" aria-live="polite">{connection}</Text>
               {connection !== 'Checking connection…' && <Button unstyled onPress={() => setAttempt((value) => value + 1)} role="button" aria-label="Retry connection" minHeight={44} justifyContent="center" alignSelf="flex-start">
                  <Text color={colors.blue} fontFamily="$body" fontSize={13}>Retry connection</Text>
               </Button>}
            </YStack> : null}
            <YStack gap={8}>
               <Text style={fieldLabel}>EMAIL</Text>
               <Input value={email} onChangeText={setEmail} placeholder="email@website.com" autoCapitalize="none" autoComplete="email" keyboardType="email-address" aria-label="Email" style={fieldStyle} />
            </YStack>
            <YStack gap={8}>
               <Text style={fieldLabel}>PASSWORD</Text>
               <Input value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry autoCapitalize="none" autoComplete={signUp ? 'new-password' : 'current-password'} aria-label="Password" style={fieldStyle} onSubmitEditing={submit} returnKeyType="go" />
            </YStack>
            {error ? <Text color={colors.error} fontSize={13} role="alert" aria-live="polite">{error}</Text> : null}
            {message ? <Text color={colors.text} fontSize={13} role="status" aria-live="polite">{message}</Text> : null}
            {!signUp && <Button minHeight={44} disabled={busy} backgroundColor="transparent" color={colors.blue} onPress={async()=>{if(!supabase)return;setError('');setMessage('');if(!email.trim()){setError('Enter your email address first.');return;}setBusy(true);try{const {error}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:recoveryRedirect()});if(error)throw error;setMessage('If that email has an account, a recovery link has been sent.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>Forgot password?</Button>}
            <Button onPress={submit} disabled={busy || Boolean(connection)} role="button" backgroundColor={colors.text} color={colors.background} borderRadius={2} height={52} marginTop={4} opacity={busy || connection ? 0.5 : 1} pressStyle={{ backgroundColor: '#d0d0d0' }}>
               <Text color={colors.background} fontFamily="$body" fontSize={15} fontWeight="700">{busy ? 'Please wait…' : signUp ? 'Sign up' : 'Login'}</Text>
            </Button>
            <XStack justifyContent="center" flexWrap="wrap" gap={4}>
               <Text color={colors.muted} fontFamily="$body" fontSize={13}>{signUp ? 'Already have an account?' : "Don't have an account?"}</Text>
               <Button unstyled onPress={() => router.replace(signUp ? '/(auth)/login' : '/(auth)/sign-up')} role="button" aria-label={signUp ? 'Go to login' : 'Go to sign up'} minHeight={44} justifyContent="center">
                  <Text color={colors.blue} fontFamily="$body" fontSize={13}>{signUp ? 'Login' : 'Sign up'}</Text>
               </Button>
            </XStack>
         </YStack>
      </YStack>
   </SafeAreaView>;
}
