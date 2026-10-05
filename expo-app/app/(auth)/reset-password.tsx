import React, { useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';
import { router } from 'expo-router';
import { Button, Input, Text, YStack, ScrollView } from 'tamagui';
import { supabase } from '@/lib/supabase';
import { receiveAuthLink, updateRecoveredPassword } from '@/lib/authLinks';
import { signOutAccount } from '@/lib/drops/account';
export default function ResetPassword() {
  const [password,setPassword]=useState('');const [again,setAgain]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  useEffect(()=>{let active=true;void (Platform.OS==='web'?Promise.resolve(window.location.href):Linking.getInitialURL()).then(async url=>{if(url)await receiveAuthLink(url);if(Platform.OS==='web')window.history.replaceState(null,'','/reset-password');}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
  async function save(){if(!supabase||busy)return;setBusy(true);setError('');try{await updateRecoveredPassword(password,again);setPassword('');setAgain('');router.replace('/');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <ScrollView backgroundColor="#0c0c0c" contentContainerStyle={{flexGrow:1,padding:24,justifyContent:'center'}}><YStack maxWidth={480} width="100%" alignSelf="center" gap={20}><Text color="#e9e9e9" fontSize={36} fontFamily="$heading">Reset password</Text><Input aria-label="New password" secureTextEntry value={password} onChangeText={setPassword} minHeight={48}/><Input aria-label="Confirm new password" secureTextEntry value={again} onChangeText={setAgain} minHeight={48}/>{error?<Text color="#ffb3aa" role="alert">{error}</Text>:null}<Button minHeight={48} disabled={busy} onPress={()=>void save()}>{busy?'Saving…':'Save new password'}</Button><Button minHeight={44} disabled={busy} onPress={()=>{void signOutAccount().then(()=>router.replace('/(auth)/login')).catch(e=>setError(e.message));}}>Back to login</Button></YStack></ScrollView>;
}
