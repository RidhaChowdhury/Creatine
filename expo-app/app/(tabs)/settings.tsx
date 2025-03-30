import { View, SafeAreaView, TouchableOpacity, ScrollView } from 'react-native'
import React from 'react'
import { Button, ButtonText } from "@/components/ui/button"
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/authContext'
import { Text } from '@/components/ui/text/'
import {CircleUser, Pencil, Check, X, Crown} from 'lucide-react-native'
import { UserSettings } from '@/types'
import { Input, InputField } from "@/components/ui/input"
import { Select, SelectBackdrop, SelectContent, SelectDragIndicator, SelectDragIndicatorWrapper, SelectIcon, SelectInput, SelectItem, SelectPortal, SelectTrigger } from '@/components/ui/select'
import { ChevronDownIcon } from '@/components/ui/icon'



const Settings = () => {
    const { user } = useAuth()
    const [settings, setSettings] = React.useState<UserSettings | null>(null);
    const [formState, setFormState] = React.useState({})
    const [activeEditSection, setActiveEditSection] = React.useState<string | null>(null);

    const toggleEdit = (section: string) => {
        setActiveEditSection(prev => (prev === section ? null : section));
    };
    
    const handleInputChange = (field: string, value: string) => {
        setFormState(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleSave = async () => {
        // console.log('Saving settings:', formState)
        if (!settings) return;
        const { error } = await supabase
            .from('user_settings')
            .update({
                ...formState
            })
            .eq('user_id', user?.id)
            .single()

        if (error) {
            console.error('Error updating user settings:', error)
            return
        }

        setSettings({ ...settings, ...formState })
        toggleEdit(activeEditSection!)
    };

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
            setFormState(data)
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
            <Button className='bg-[#A9A969] mt-[10]'>
                <Text className='text-white text-[20px] font-semibold'>Get PRO</Text>
                <Crown color={'white'} size={20}></Crown>
            </Button>
            <View>
                <View className='flex-row items-center justify-between'>
                    <Text className="text-[20px] pt-[10] font-semibold pr-[5]">Profile Settings</Text>
                    {(activeEditSection !== 'profile') ? (
                    <TouchableOpacity className='pt-[10]' onPress={() => toggleEdit('profile')}>
                        <Pencil color={'white'} size={18}></Pencil>
                    </TouchableOpacity>
                    ) : (
                        <View className='flex-row'>
                            <TouchableOpacity className='pt-[10] pr-[25]' onPress={() => toggleEdit('profile')}>
                                <X color={'white'} size={24}></X>
                            </TouchableOpacity>
                            <TouchableOpacity className='pt-[10]' onPress={() => handleSave()}>
                                <Check color={'white'} size={24}></Check>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                <View>
                    <Text className='text-[14px] py-[4] text-typography-300'>Name</Text>
                    <Input isDisabled={activeEditSection !== 'profile'} 
                    >
                        <InputField onChangeText={(e: string) => handleInputChange('name', e)} >{settings?.name}</InputField>
                    </Input>
                    <Text className='text-[14px] py-[4] text-typography-300'>Email</Text>
                    <Input isDisabled={true} >
                        <InputField >{user?.email}</InputField>
                    </Input>
                </View>
            </View>

            <View>
                <View className='flex-row items-center justify-between'>
                    <Text className="text-[20px] pt-[15] font-semibold">Goals</Text>
                    {(activeEditSection !== 'goals') ? (
                    <TouchableOpacity className='pt-[15]' onPress={() => toggleEdit('goals')}>
                        <Pencil color={'white'} size={18}></Pencil>
                    </TouchableOpacity>
                    ) : (
                        <View className='flex-row'>
                            <TouchableOpacity className='pt-[15] pr-[25]' onPress={() => toggleEdit('goals')}>
                                <X color={'white'} size={24}></X>
                            </TouchableOpacity>
                            <TouchableOpacity className='pt-[15]' onPress={() => handleSave()}>
                                <Check color={'white'} size={24}></Check>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
                    <View>
                        <Text className='text-[14px] py-[4] text-typography-300'>Water Goal ({settings?.water_unit})</Text>
                        <Input isDisabled={activeEditSection !== 'goals'}>
                            <InputField onChangeText={(e: string) => handleInputChange('water_goal', e)}>{settings?.water_goal}</InputField>
                        </Input>
                        <Text className='text-[14px] py-[4] text-typography-300'>Creatine Goal ({settings?.supplement_unit})</Text>
                        <Input isDisabled={activeEditSection !== 'goals'} >
                            <InputField onChangeText={(e: string) => handleInputChange('creatine_goal', e)}>{settings?.creatine_goal}</InputField>
                        </Input>
                    </View>
            </View>

            <View>
                <View className='flex-row items-center justify-between'>
                    <Text className="text-[20px] pt-[15] font-semibold">Metrics</Text>
                    {(activeEditSection !== 'metrics') ? (
                    <TouchableOpacity className='pt-[15]' onPress={() => toggleEdit('metrics')}>
                        <Pencil color={'white'} size={18}></Pencil>
                    </TouchableOpacity>
                    ) : (
                        <View className='flex-row'>
                            <TouchableOpacity className='pt-[15] pr-[25]' onPress={() => toggleEdit('metrics')}>
                                <X color={'white'} size={24}></X>
                            </TouchableOpacity>
                            <TouchableOpacity className='pt-[15]' onPress={() => handleSave()}>
                                <Check color={'white'} size={24}></Check>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
                    <View>
                        <Text className='text-[14px] py-[4] text-typography-300'>Height</Text>
                        <Input isDisabled={activeEditSection !== 'metrics'}>
                            <InputField onChangeText={(e: string) => handleInputChange('height', e)}>{settings?.height}</InputField>
                        </Input>
                        <Text className='text-[14px] py-[4] text-typography-300'>Weight</Text>
                        <Input isDisabled={activeEditSection !== 'metrics'} >
                            <InputField onChangeText={(e: string) => handleInputChange('weight', e)}>{settings?.weight}</InputField>
                        </Input>
                        <Text className='text-[14px] py-[4] text-typography-300'>Sex</Text>
                        <Select isDisabled={activeEditSection !== 'metrics'} onValueChange={(value: string) => handleInputChange('sex', value)}>
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
                    {(activeEditSection !== 'preferences') ? (
                    <TouchableOpacity className='pt-[15]' onPress={() => toggleEdit('preferences')}>
                        <Pencil color={'white'} size={18}></Pencil>
                    </TouchableOpacity>
                    ) : (
                        <View className='flex-row'>
                            <TouchableOpacity className='pt-[15] pr-[25]' onPress={() => toggleEdit('preferences')}>
                                <X color={'white'} size={24}></X>
                            </TouchableOpacity>
                            <TouchableOpacity className='pt-[15]' onPress={() => handleSave()}>
                                <Check color={'white'} size={24}></Check>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
                    <View>
                        <Text className='text-[14px] py-[4] text-typography-300'>Water Unit</Text>
                        <Select isDisabled={activeEditSection !== 'preferences'} onValueChange={(value: string) => handleInputChange('water_unit', value)}>
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
                        <Text className='text-[14px] py-[4] text-typography-300'>Supplement Unit</Text>
                        <Select isDisabled={activeEditSection !== 'preferences'} onValueChange={(value: string) => handleInputChange('supplement_unit', value)}>
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

            

            <Button className='mt-[15] mb-[15]' onPress={() => supabase.auth.signOut()}>
                <ButtonText>Log Out</ButtonText>
            </Button>
        </ScrollView>

    </SafeAreaView>
  )
}

export default Settings