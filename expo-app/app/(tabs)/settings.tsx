import { View, SafeAreaView, TouchableOpacity, ScrollView } from 'react-native'
import React, { useContext } from 'react'
import { Button, ButtonText } from "@/components/ui/button"
import { supabase } from '@/lib/supabase'
import { Text } from '@/components/ui/text/'
import {CircleUser, Pencil, Check, X, Crown} from 'lucide-react-native'
import { UserSettings } from '@/types'
import { Input, InputField } from "@/components/ui/input"
import { Select, SelectBackdrop, SelectContent, SelectDragIndicator, SelectDragIndicatorWrapper, SelectIcon, SelectInput, SelectItem, SelectPortal, SelectSectionHeaderText, SelectTrigger } from '@/components/ui/select'
import { ChevronDownIcon } from '@/components/ui/icon'
import { router } from 'expo-router'
import { Box } from '@/components/ui/box'
import { RefreshContext, RefreshContextType } from "@/context/refreshContext";
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { selectUser, setUser } from '@/features/auth/authSlice'

const Settings = () => {
    const dispatch = useAppDispatch();
    const user = useAppSelector(selectUser)
    const [settings, setSettings] = React.useState<UserSettings | null>(null);
    const [formState, setFormState] = React.useState({})
    const [activeEditSection, setActiveEditSection] = React.useState<string | null>(null);
    const { refresh, refreshTrigger } = useContext<RefreshContextType>(RefreshContext);
    
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
        refresh('creatine');
        refresh('water');
    };

    React.useEffect(() => {
      if ( !user ) return;
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
      <SafeAreaView className="bg-background-0 h-full">
        <ScrollView showsVerticalScrollIndicator={false} className="px-[15]">
          <View className="flex-row items-center">
            <CircleUser color={"white"} size={48} />
            <Text className="text-[20px] font-semibold pl-[7]">
              {settings?.name}
            </Text>
          </View>
          <Button className="bg-[#2B4593] mt-[10] h-[45] rounded-[15px]">
            <Text className="text-[#EEC700] text-[20px] font-semibold">
              Get PRO
            </Text>
            <Crown color={"#EEC700"} size={20}></Crown>
          </Button>
          <Box className="mt-4 bg-primary-0 rounded-[15px] p-[12]">
            <View className="flex-row items-center justify-between">
              <Text className="text-[24px] pt-[5] font-semibold pr-[5]">
                Profile Settings
              </Text>
              {activeEditSection !== "profile" ? (
                <TouchableOpacity
                  className="pt-[10]"
                  onPress={() => toggleEdit("profile")}
                >
                  <Pencil color={"white"} size={18}></Pencil>
                </TouchableOpacity>
              ) : (
                <View className="flex-row">
                  <TouchableOpacity
                    className="pt-[10] pr-[25]"
                    onPress={() => toggleEdit("profile")}
                  >
                    <X color={"white"} size={24}></X>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="pt-[10]"
                    onPress={() => handleSave()}
                  >
                    <Check color={"white"} size={24}></Check>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View>
              <Text className="text-[14px] py-[4] text-typography-300">
                Name
              </Text>
              <Input
                className="h-[45]"
                isDisabled={activeEditSection !== "profile"}
              >
                <InputField
                  onChangeText={(e: string) => handleInputChange("name", e)}
                >
                  {settings?.name}
                </InputField>
              </Input>
              <Text className="text-[14px] py-[4] pt-[8] text-typography-300">
                Email
              </Text>
              <Input className="h-[45] mb-[5]" isDisabled={true}>
                <InputField>{user?.email}</InputField>
              </Input>
            </View>
          </Box>

          <Box className="mt-4 bg-primary-0 rounded-[15px] p-[12] pb-[12]">
            <View className="flex-row items-center justify-between">
              <Text className="text-[24px] pt-[5] font-semibold pr-[5]">
                Goals
              </Text>
              {activeEditSection !== "goals" ? (
                <TouchableOpacity
                  className="pt-[15]"
                  onPress={() => toggleEdit("goals")}
                >
                  <Pencil color={"white"} size={18}></Pencil>
                </TouchableOpacity>
              ) : (
                <View className="flex-row">
                  <TouchableOpacity
                    className="pt-[15] pr-[25]"
                    onPress={() => toggleEdit("goals")}
                  >
                    <X color={"white"} size={24}></X>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="pt-[15]"
                    onPress={() => handleSave()}
                  >
                    <Check color={"white"} size={24}></Check>
                  </TouchableOpacity>
                </View>
              )}
            </View>
            <View>
              <Text className="text-[14px] py-[4] text-typography-300">
                Water Goal ({settings?.water_unit})
              </Text>
              <Input
                className="h-[45]"
                isDisabled={activeEditSection !== "goals"}
              >
                <InputField
                  onChangeText={(e: string) =>
                    handleInputChange("water_goal", e)
                  }
                >
                  {settings?.water_goal}
                </InputField>
              </Input>
              <Text className="text-[14px] py-[4] pt-[8] text-typography-300">
                Creatine Goal ({settings?.supplement_unit})
              </Text>
              <Input
                className="h-[45] mb-[5]"
                isDisabled={activeEditSection !== "goals"}
              >
                <InputField
                  onChangeText={(e: string) =>
                    handleInputChange("creatine_goal", e)
                  }
                >
                  {settings?.creatine_goal}
                </InputField>
              </Input>
            </View>
          </Box>

          <Box className="mt-4 bg-primary-0 rounded-[15px] p-[12] pb-[12]">
            <View className="flex-row items-center justify-between">
              <Text className="text-[24px] pt-[5] font-semibold">Metrics</Text>
              {activeEditSection !== "metrics" ? (
                <TouchableOpacity
                  className="pt-[10]"
                  onPress={() => toggleEdit("metrics")}
                >
                  <Pencil color={"white"} size={18}></Pencil>
                </TouchableOpacity>
              ) : (
                <View className="flex-row">
                  <TouchableOpacity
                    className="pt-[10] pr-[25]"
                    onPress={() => toggleEdit("metrics")}
                  >
                    <X color={"white"} size={24}></X>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="pt-[15]"
                    onPress={() => handleSave()}
                  >
                    <Check color={"white"} size={24}></Check>
                  </TouchableOpacity>
                </View>
              )}
            </View>
            <View>
              <Text className="text-[14px] py-[4] text-typography-300">
                Height (in)
              </Text>
              <Input
                className="h-[45]"
                isDisabled={activeEditSection !== "metrics"}
              >
                <InputField
                  onChangeText={(e: string) => handleInputChange("height", e)}
                >
                  {settings?.height}
                </InputField>
              </Input>
              <Text className="text-[14px] pt-[8] py-[4] text-typography-300">
                Weight (lbs)
              </Text>
              <Input
                className="h-[45]"
                isDisabled={activeEditSection !== "metrics"}
              >
                <InputField
                  onChangeText={(e: string) => handleInputChange("weight", e)}
                >
                  {settings?.weight}
                </InputField>
              </Input>
              <Text className="text-[14px] pt-[8] py-[4] text-typography-300">
                Sex
              </Text>
              <Select
                className="h-[45] mb-[5]"
                isDisabled={activeEditSection !== "metrics"}
                onValueChange={(value: string) =>
                  handleInputChange("sex", value)
                }
              >
                <SelectTrigger
                  className="h-[45] justify-between"
                  variant="outline"
                  size="md"
                >
                  <SelectInput
                    placeholder={
                      settings?.sex != null ? settings?.sex : "Select"
                    }
                  />
                  <SelectIcon className="mr-3" as={ChevronDownIcon} />
                </SelectTrigger>
                <SelectPortal>
                  <SelectBackdrop />
                  <SelectContent>
                    <SelectDragIndicatorWrapper>
                      <SelectDragIndicator />
                    </SelectDragIndicatorWrapper>
                    <View style={{ width: "100%", paddingBottom: 30 }}>
                      <SelectSectionHeaderText className="text-xl">Sex</SelectSectionHeaderText>
                      <SelectItem label="Male" value="male" />
                      <SelectItem label="Female" value="female" />
                    </View>
                  </SelectContent>
                </SelectPortal>
              </Select>
            </View>
          </Box>

          <Box className="mt-4 bg-primary-0 rounded-[15px] p-[12] pb-[12]">
            <View className="flex-row items-center justify-between">
              <Text className="text-[24px] pt-[5] font-semibold">
                Preferences
              </Text>
              {/* {activeEditSection !== "preferences" ? (
                <TouchableOpacity
                  className="pt-[15]"
                  onPress={() => toggleEdit("preferences")}
                >
                  <Pencil color={"white"} size={18}></Pencil>
                </TouchableOpacity>
              ) : (
                <View className="flex-row">
                  <TouchableOpacity
                    className="pt-[15] pr-[25]"
                    onPress={() => toggleEdit("preferences")}
                  >
                    <X color={"white"} size={24}></X>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="pt-[15]"
                    onPress={() => handleSave()}
                  >
                    <Check color={"white"} size={24}></Check>
                  </TouchableOpacity>
                </View>
              )} */}
            </View>
            <View>
              <Text className="text-[14px] pt-[8] py-[4] text-typography-300">
                Water Unit
              </Text>
              <Select
                className="h-[45]"
                isDisabled={activeEditSection !== "preferences"}
                onValueChange={(value: string) =>
                  handleInputChange("water_unit", value)
                }
              >
                <SelectTrigger
                  className="h-[45] justify-between"
                  variant="outline"
                  size="md"
                >
                  <SelectInput placeholder={settings?.water_unit} />
                  <SelectIcon className="mr-3" as={ChevronDownIcon} />
                </SelectTrigger>
                <SelectPortal>
                  <SelectBackdrop />
                  <SelectContent>
                    <SelectDragIndicatorWrapper>
                      <SelectDragIndicator />
                    </SelectDragIndicatorWrapper>
                    <View style={{ width: "100%", paddingBottom: 30 }}>
                      <SelectSectionHeaderText className="text-xl">
                        Water Unit
                      </SelectSectionHeaderText>
                      <SelectItem label="ml" value="ml" />
                      <SelectItem label="oz" value="oz" />
                    </View>
                  </SelectContent>
                </SelectPortal>
              </Select>
              <Text className="text-[14px] pt-[8] py-[4] text-typography-300">
                Supplement Unit
              </Text>
              <Select
                className="h-[45] mb-[5]"
                isDisabled={activeEditSection !== "preferences"}
                onValueChange={(value: string) =>
                  handleInputChange("supplement_unit", value)
                }
              >
                <SelectTrigger
                  className="h-[45] justify-between"
                  variant="outline"
                  size="md"
                >
                  <SelectInput placeholder={settings?.supplement_unit} />
                  <SelectIcon className="mr-3" as={ChevronDownIcon} />
                </SelectTrigger>
                <SelectPortal>
                  <SelectBackdrop />
                  <SelectContent>
                    <SelectDragIndicatorWrapper>
                      <SelectDragIndicator />
                    </SelectDragIndicatorWrapper>
                    <View style={{ width: "100%", paddingBottom: 30 }}>
                      <SelectSectionHeaderText className="text-xl">
                        Supplement Unit
                      </SelectSectionHeaderText>
                      <SelectItem label="g" value="g" />
                      <SelectItem label="mg" value="mg" />
                    </View>
                  </SelectContent>
                </SelectPortal>
              </Select>
            </View>
          </Box>

          <Button
            className="mt-[15] mb-[25] h-[45] rounded-[15px]"
            onPress={() => {
              supabase.auth.signOut();
            }}
          >
            <ButtonText className="text-[20px] font-semibold">
              Log Out
            </ButtonText>
          </Button>
        </ScrollView>
      </SafeAreaView>
    );
}

export default Settings