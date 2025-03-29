import { View, SafeAreaView, TouchableOpacity, ScrollView } from 'react-native'
import React from 'react'
import { Button, ButtonText } from "@/components/ui/button"
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/authContext'
import { Text } from '@/components/ui/text/'
import {CircleUser, Pencil, Check, X} from 'lucide-react-native'
import { UserSettings } from '@/types'
import { Input, InputField } from "@/components/ui/input"
import { Select, SelectBackdrop, SelectContent, SelectDragIndicator, SelectDragIndicatorWrapper, SelectIcon, SelectInput, SelectItem, SelectPortal, SelectTrigger } from '@/components/ui/select'
import { ChevronDownIcon } from '@/components/ui/icon'



const Settings = () => {
    const { user } = useAuth()
    const [settings, setSettings] = React.useState<UserSettings | null>(null);
    const [editProfile, setEditProfile] = React.useState(false);
    const [editMetrics, setEditMetrics] = React.useState(false);
    const [editGoals, setEditGoals] = React.useState(false);
    const [editPreferences, setEditPreferences] = React.useState(false);


    React.useEffect(() => {
        const fetchSettings = async () => {
            const { data, error } = await supabase
                .from('user_settings')
                .select('*')
                .eq('user_id', user?.id)
                .single()

            if (error) {
                console.error('Error fetching user settings:', error)
                return
            }

            setSettings(data)
        }

        fetchSettings()
    }, [user])

    return (
    <SafeAreaView className='bg-background-0 h-full'>
        <ScrollView className='px-[15]'>
            <View className="flex-row items-center">
                <CircleUser color={'white'} size={48} />
                <Text className='text-[20px] font-semibold pl-[7]'>{settings?.name}</Text>
            </View>
            <View>
                <View className='flex-row items-center justify-between'>
                    <Text className="text-[20px] pt-[10] font-semibold pr-[5]">Profile Settings</Text>
                    {(!editProfile) ? (
                    <TouchableOpacity className='pt-[10]' onPress={() => setEditProfile(prev => !prev)}>
                        <Pencil color={'white'} size={18}></Pencil>
                    </TouchableOpacity>
                    ) : (
                        <View className='flex-row'>
                            <TouchableOpacity className='pt-[10] pr-[25]' onPress={() => setEditProfile(prev => !prev)}>
                                <X color={'white'} size={24}></X>
                            </TouchableOpacity>
                            <TouchableOpacity className='pt-[10]' onPress={() => setEditProfile(prev => !prev)}>
                                <Check color={'white'} size={24}></Check>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                <View>
                    <Text className='text-[14px] py-[4]'>Name</Text>
                    <Input isDisabled={!editProfile}>
                        <InputField >{settings?.name}</InputField>
                    </Input>
                    <Text className='text-[14px] py-[4]'>Email</Text>
                    <Input isDisabled={true} >
                        <InputField >{user?.email}</InputField>
                    </Input>
                </View>
            </View>

            <View>
                <View className='flex-row items-center justify-between'>
                    <Text className="text-[20px] pt-[15] font-semibold">Goals</Text>
                    {(!editGoals) ? (
                    <TouchableOpacity className='pt-[15]' onPress={() => setEditGoals(prev => !prev)}>
                        <Pencil color={'white'} size={18}></Pencil>
                    </TouchableOpacity>
                    ) : (
                        <View className='flex-row'>
                            <TouchableOpacity className='pt-[15] pr-[25]' onPress={() => setEditGoals(prev => !prev)}>
                                <X color={'white'} size={24}></X>
                            </TouchableOpacity>
                            <TouchableOpacity className='pt-[15]' onPress={() => setEditGoals(prev => !prev)}>
                                <Check color={'white'} size={24}></Check>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
                    <View>
                        <Text className='text-[14px] py-[4]'>Water Goal ({settings?.water_unit})</Text>
                        <Input isDisabled={!editGoals}>
                            <InputField >{settings?.water_goal}</InputField>
                        </Input>
                        <Text className='text-[14px] py-[4]'>Creatine Goal ({settings?.supplement_unit})</Text>
                        <Input isDisabled={!editGoals} >
                            <InputField >{settings?.creatine_goal}</InputField>
                        </Input>
                    </View>
            </View>

            <View>
                <View className='flex-row items-center justify-between'>
                    <Text className="text-[20px] pt-[15] font-semibold">Metrics</Text>
                    {(!editMetrics) ? (
                    <TouchableOpacity className='pt-[15]' onPress={() => setEditMetrics(prev => !prev)}>
                        <Pencil color={'white'} size={18}></Pencil>
                    </TouchableOpacity>
                    ) : (
                        <View className='flex-row'>
                            <TouchableOpacity className='pt-[15] pr-[25]' onPress={() => setEditMetrics(prev => !prev)}>
                                <X color={'white'} size={24}></X>
                            </TouchableOpacity>
                            <TouchableOpacity className='pt-[15]' onPress={() => setEditMetrics(prev => !prev)}>
                                <Check color={'white'} size={24}></Check>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
                    <View>
                        <Text className='text-[14px] py-[4]'>Height</Text>
                        <Input isDisabled={!editMetrics}>
                            <InputField >{settings?.height}</InputField>
                        </Input>
                        <Text className='text-[14px] py-[4]'>Weight</Text>
                        <Input isDisabled={!editMetrics} >
                            <InputField >{settings?.weight}</InputField>
                        </Input>
                        <Text className='text-[14px] py-[4]'>Sex</Text>
                        <Select isDisabled={!editMetrics}>
                            <SelectTrigger variant="outline" size="md">
                                <SelectInput placeholder={settings?.sex != null ? settings?.sex : 'Select'} />
                                <SelectIcon className="mr-3" as={ChevronDownIcon} />
                            </SelectTrigger>
                            <SelectPortal>
                                <SelectBackdrop />
                                <SelectContent>
                                <SelectDragIndicatorWrapper>
                                    <SelectDragIndicator />
                                </SelectDragIndicatorWrapper>
                                <SelectItem label="Male" value="male" />
                                <SelectItem label="Female" value="female" />
                                </SelectContent>
                            </SelectPortal>
                        </Select>
                    </View>
            </View>

            <View>
                <View className='flex-row items-center justify-between'>
                    <Text className="text-[20px] pt-[15] font-semibold">Preferences</Text>
                    {(!editPreferences) ? (
                    <TouchableOpacity className='pt-[15]' onPress={() => setEditPreferences(prev => !prev)}>
                        <Pencil color={'white'} size={18}></Pencil>
                    </TouchableOpacity>
                    ) : (
                        <View className='flex-row'>
                            <TouchableOpacity className='pt-[15] pr-[25]' onPress={() => setEditPreferences(prev => !prev)}>
                                <X color={'white'} size={24}></X>
                            </TouchableOpacity>
                            <TouchableOpacity className='pt-[15]' onPress={() => setEditPreferences(prev => !prev)}>
                                <Check color={'white'} size={24}></Check>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
                    <View>
                        <Text className='text-[14px] py-[4]'>Water Unit</Text>
                        <Select isDisabled={!editPreferences}>
                            <SelectTrigger variant="outline" size="md">
                                <SelectInput placeholder={settings?.water_unit} />
                                <SelectIcon className="mr-3" as={ChevronDownIcon} />
                            </SelectTrigger>
                            <SelectPortal>
                                <SelectBackdrop />
                                <SelectContent>
                                <SelectDragIndicatorWrapper>
                                    <SelectDragIndicator />
                                </SelectDragIndicatorWrapper>
                                <SelectItem label="ml" value="ml" />
                                <SelectItem label="oz" value="oz" />
                                </SelectContent>
                            </SelectPortal>
                        </Select>
                        <Text className='text-[14px] py-[4]'>Supplement Unit</Text>
                        <Select isDisabled={!editPreferences}>
                            <SelectTrigger variant="outline" size="md">
                                <SelectInput placeholder={settings?.supplement_unit} />
                                <SelectIcon className="mr-3" as={ChevronDownIcon} />
                            </SelectTrigger>
                            <SelectPortal>
                                <SelectBackdrop />
                                <SelectContent>
                                <SelectDragIndicatorWrapper>
                                    <SelectDragIndicator />
                                </SelectDragIndicatorWrapper>
                                <SelectItem label="g" value="g" />
                                <SelectItem label="mg" value="mg" />
                                </SelectContent>
                            </SelectPortal>
                        </Select>
                    </View>
            </View>

            

            <Button className='mt-[15]' onPress={() => supabase.auth.signOut()}>
                <ButtonText>Log Out</ButtonText>
            </Button>
        </ScrollView>

    </SafeAreaView>
  )
}

export default Settings