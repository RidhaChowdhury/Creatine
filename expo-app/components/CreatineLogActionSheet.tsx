import React, { useState, useEffect } from "react";
import { Keyboard, Platform, View } from "react-native";
import {
  Actionsheet,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetBackdrop,
  ActionsheetSectionHeaderText,
} from "@/components/ui/actionsheet";
import { Button, ButtonText } from "@/components/ui/button";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectInput,
  SelectIcon,
  SelectPortal,
  SelectBackdrop,
  SelectContent,
  SelectDragIndicatorWrapper,
  SelectDragIndicator,
  SelectItem,
} from "@/components/ui/select";
import { Text } from "@/components/ui/text";
import { ChevronDownIcon } from "@/components/ui/icon";
import { supabase } from "@/lib/supabase";

const CREATINE_FORMS = ["Monohydrate", "HCL", "Micronized"] as const;
type CreatineForm = (typeof CREATINE_FORMS)[number];

const logCreatineIntake = async (grams: string, form: CreatineForm) => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const gramsValue = parseFloat(grams);
    if (isNaN(gramsValue)) throw new Error("Invalid amount");

    const { data, error } = await supabase
      .from("creatine_logs")
      .insert([
        {
          user_id: user.id,
          dose_grams: gramsValue,
          form: form.toLowerCase(),
        },
      ])
      .select();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error logging creatine:", error);
    throw error;
  }
};

interface CreatineLogActionsheetProps {
  showActionsheet: boolean;
  handleClose: () => void;
  onLog: (grams: string, form: CreatineForm) => void;
}

export const CreatineLogActionsheet: React.FC<CreatineLogActionsheetProps> = ({
  showActionsheet,
  handleClose,
  onLog,
}) => {
  const [grams, setGrams] = useState<string>("");
  const [form, setForm] = useState<CreatineForm>("Monohydrate");
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardHeight(0)
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  return (
    <Actionsheet isOpen={showActionsheet} onClose={handleClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent style={{ paddingBottom: keyboardHeight + 30 }}>
        <View style={{ width: "100%" }}>
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>

          <ActionsheetSectionHeaderText className="text-2xl">Creatine</ActionsheetSectionHeaderText>

          <VStack className="w-full px-4" space="md">
            <HStack className="w-full" space="md">
              {/* Amount Input */}
              <View className="flex-1">
                <Text className="text-xs text-typography-300 mb-1">
                  Amount (grams)
                </Text>
                <Input>
                  <InputField
                    value={grams}
                    onChangeText={setGrams}
                    placeholder="0.0"
                    keyboardType="decimal-pad"
                  />
                </Input>
              </View>

              {/* Form Type Select */}
              <View className="flex-1">
                <Text className="text-xs text-typography-500 mb-1">
                  Form Type
                </Text>
                <Select
                  selectedValue={form}
                  onValueChange={(value: string) =>
                    setForm(value as CreatineForm)
                  }
                >
                  <SelectTrigger
                    variant="outline"
                    size="md"
                    className="justify-between"
                  >
                    <SelectInput placeholder="Select form" />
                    <SelectIcon as={ChevronDownIcon} className="mx-2" />
                  </SelectTrigger>
                  <SelectPortal>
                    <SelectBackdrop />
                    <SelectContent style={{ paddingBottom: 30 }}>
                      <SelectDragIndicatorWrapper>
                        <SelectDragIndicator />
                      </SelectDragIndicatorWrapper>
                      {CREATINE_FORMS.map((option) => (
                        <SelectItem
                          key={option}
                          label={option}
                          value={option}
                          className="rounded-xl"
                        />
                      ))}
                    </SelectContent>
                  </SelectPortal>
                </Select>
              </View>
            </HStack>

            {/* Log Button */}
            <Button
              size="lg"
              variant="solid"
              className={`w-full bg-primary-0 ${!grams ? "opacity-70" : ""}`}
              onPress={async () => {
                if (grams) {
                    await logCreatineIntake(grams, form);
                    onLog(grams, form); // Call the onLog callback with the grams and form
                    Keyboard.dismiss();
                    handleClose(); // Close the action sheet after logging
                }
              }}
              isDisabled={!grams}
            >
              <ButtonText className="font-medium text-white">
                Log Creatine
              </ButtonText>
            </Button>
          </VStack>
        </View>
      </ActionsheetContent>
    </Actionsheet>
  );
};