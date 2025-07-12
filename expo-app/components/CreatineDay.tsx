import { View, FlatList, TouchableOpacity } from 'react-native'
import React, { useEffect, useContext } from 'react'
import { Text } from './ui/text'
import { Box } from "@/components/ui/box";
import { supabase } from '@/lib/supabase';
import {Ellipsis} from 'lucide-react-native'
import {
    Actionsheet,
    ActionsheetContent,
    ActionsheetItem,
    ActionsheetItemText,
    ActionsheetDragIndicator,
    ActionsheetDragIndicatorWrapper,
    ActionsheetBackdrop,
  } from "@/components/ui/actionsheet"

  import {
    Modal,
    ModalBackdrop,
    ModalContent,
    ModalCloseButton,
    ModalHeader,
    ModalBody,
    ModalFooter,
  } from "@/components/ui/modal"
import { Heading } from './ui/heading';
import { Icon, CloseIcon, ChevronDownIcon } from './ui/icon';
import { Button, ButtonText } from './ui/button';
import { Input, InputField } from './ui/input';
import { Select, SelectBackdrop, SelectContent, SelectDragIndicator, SelectDragIndicatorWrapper, SelectIcon, SelectInput, SelectItem, SelectPortal, SelectTrigger } from '@/components/ui/select'
import { ActionsheetSectionHeaderText } from './ui/select/select-actionsheet';
import { selectUser } from "@/features/auth/authSlice";
import { useAppSelector } from "@/store/hooks";

const CreatineDay = (props :any) => {
    const user = useAppSelector(selectUser);
    const [data, setData] =  React.useState<any[]>([]);
    const [showActionsheet, setShowActionsheet] = React.useState(false)
    const handleClose = () => setShowActionsheet(false)
    const [showModal, setShowModal] = React.useState(false)
    const [editId, setEditId] = React.useState('')
    const [dose, setDose] = React.useState('')
    const [form, setForm] = React.useState('')
    

    const handleDelete = async (id: string) => {
        const { error } = await supabase
        .from('creatine_logs')
        .delete()
        .eq('id', id)
        if (error) {
            console.error('Error deleting creatine log:', error);
            return;
        }
        console.log('Deleted creatine log:', id);
        handleClose();
    }

    const handleEdit = async (id: string) => {  
        const { error } = await supabase
        .from('creatine_logs')
        .update({ dose_grams: dose, form: form })
        .eq('id', id)
        if (error) {
            console.error('Error updating creatine log:', error);
            return;
        }
        console.log('Updated creatine log:', id);
        handleClose();
    }

    useEffect(() => {
        const fetchCreatineData = async () => { 
            const { data, error } = await supabase
            .from('creatine_logs')
            .select('*')
            .lt('taken_at', `${props.day} 23:59:59`)
            .gt('taken_at', `${props.day} 00:00:00`)
            if (error) {
                console.error('Error fetching creatine data:', error);
                return;
            }
            setData(data);
        }
        fetchCreatineData();
    }, [props.day]);
  return (
    <View>
      <View className="flex-row items-center justify-between p-4">
        <Text className="text-[20px] font-bold text-white">
          {data.reduce((total, log) => total + log.dose_grams, 0)}{" "}
          {data.reduce((total, log) => total + log.dose_grams, 0) === 1
            ? "gram"
            : "grams"}
        </Text>
        <Text className="text-[20px] font-bold text-white">
          {Math.floor(props.dayData.saturation * 100)}%
        </Text>
        <Text className="text-[20px] font-bold text-white">{props.day}</Text>
      </View>
      <View className="mb-[10] px-[15]">
        {data.length === 0 && (
          <Text className="text-white ml-4 mb-[10]">
            No creatine logs for this day...
          </Text>
        )}
        {data.map((log) => (
          <View
            key={log.id}
            className="mb-[10] px-[15] flex-row justify-between"
          >
            <Text className="text-white">{`${log.dose_grams} ${
              log.dose_grams === 1 ? "gram" : "grams"
            }`}</Text>
            <Text className="text-white">{log.form}</Text>
            <Text className="text-white">
              {new Date(log.taken_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
            <TouchableOpacity
              onPress={() => setShowActionsheet(log.id)}
              className=""
            >
              <Ellipsis color={"white"} />
            </TouchableOpacity>
            <Actionsheet
              isOpen={showActionsheet === log.id}
              onClose={handleClose}
            >
              <ActionsheetBackdrop />
              <ActionsheetContent style={{ paddingBottom: 30 }}>
                <ActionsheetDragIndicatorWrapper>
                  <ActionsheetDragIndicator />
                </ActionsheetDragIndicatorWrapper>
                <View style={{ width: "100%" }}>
                  <ActionsheetSectionHeaderText className="text-xl">
                    Edit Creatine Entry
                  </ActionsheetSectionHeaderText>
                  <ActionsheetItem
                    onPress={() => {
                      setShowModal(log.id);
                      setEditId(log.id);
                      setDose(log.dose_grams);
                      setForm(log.form);
                    }}
                  >
                    <ActionsheetItemText className="text-lg">
                      Edit
                    </ActionsheetItemText>
                    <Modal
                      isOpen={showModal === log.id}
                      onClose={() => {
                        setShowModal(false);
                      }}
                      size="md"
                    >
                      <ModalBackdrop />
                      <ModalContent>
                        <ModalHeader>
                          <Heading size="md" className="text-typography-950">
                            Edit Creatine Log
                          </Heading>
                          <ModalCloseButton>
                            <Icon
                              as={CloseIcon}
                              size="md"
                              className="stroke-background-400 group-[:hover]/modal-close-button:stroke-background-700 group-[:active]/modal-close-button:stroke-background-900 group-[:focus-visible]/modal-close-button:stroke-background-900"
                            />
                          </ModalCloseButton>
                        </ModalHeader>
                        <ModalBody>
                          <View>
                            <Text>Dose</Text>
                            <Input className="mb-[10]">
                              <InputField
                                onChangeText={(e: string) => setDose(e)}
                              >
                                {dose.toString()}
                              </InputField>
                            </Input>
                            <Text>Type</Text>
                            <Select
                              onValueChange={(value: string) => setForm(value)}
                            >
                              <SelectTrigger
                                className="justify-between"
                                variant="outline"
                                size="md"
                              >
                                <SelectInput placeholder={form} />
                                <SelectIcon
                                  className="mr-3"
                                  as={ChevronDownIcon}
                                />
                              </SelectTrigger>
                              <SelectPortal>
                                <SelectBackdrop />
                                <SelectContent>
                                  <SelectDragIndicatorWrapper>
                                    <SelectDragIndicator />
                                  </SelectDragIndicatorWrapper>
                                  <SelectItem
                                    label="Monohydrate"
                                    value="monohydrate"
                                  />
                                  <SelectItem label="HCL" value="hcl" />
                                  <SelectItem
                                    label="Micronized"
                                    value="micronized"
                                  />
                                </SelectContent>
                              </SelectPortal>
                            </Select>
                          </View>
                        </ModalBody>
                        <ModalFooter>
                          <Button
                            variant="outline"
                            action="secondary"
                            onPress={() => {
                              setShowModal(false);
                            }}
                          >
                            <ButtonText>Cancel</ButtonText>
                          </Button>
                          <Button
                            onPress={() => {
                              handleEdit(editId);
                            }}
                          >
                            <ButtonText>Edit</ButtonText>
                          </Button>
                        </ModalFooter>
                      </ModalContent>
                    </Modal>
                  </ActionsheetItem>
                  <ActionsheetItem onPress={() => handleDelete(log.id)}>
                    <ActionsheetItemText className="text-lg">
                      Delete
                    </ActionsheetItemText>
                  </ActionsheetItem>
                </View>
              </ActionsheetContent>
            </Actionsheet>
          </View>
        ))}
      </View>
    </View>
  );
}

export default CreatineDay