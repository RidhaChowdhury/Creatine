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

const DRINK_OPTIONS = ["Water", "Juice", "Soda", "Coffee", "Tea"] as const;
type DrinkType = (typeof DRINK_OPTIONS)[number];

  const logWaterIntake = async (amount: string, drinkType: DrinkType) => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Convert amount to number and validate
      const volume = parseInt(amount);
      if (isNaN(volume)) {
        throw new Error('Invalid amount');
      }

      // Insert into water_logs table
      const { data, error } = await supabase
        .from('water_logs')
        .insert([{
          user_id: user.id,
          volume_floz: volume,
          drink_type: drinkType.toLowerCase(),
        }])
        .select(); // Returns the inserted record

      if (error) throw error;
      return data;
      
    } catch (error) {
      console.error('Error logging water intake:', error);
      throw error;
    }
  };

interface WaterLogActionsheetProps {
  showActionsheet: boolean;
  handleClose: () => void;
  onLog: (amount: string, drinkType: DrinkType) => void;
}

export const WaterLogActionsheet: React.FC<WaterLogActionsheetProps> = ({
  showActionsheet,
  handleClose,
  onLog,
}) => {
  const [amount, setAmount] = useState<string>("");
  const [drinkType, setDrinkType] = useState<DrinkType>("Water");
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

          <ActionsheetSectionHeaderText>Water</ActionsheetSectionHeaderText>

          <VStack className="w-full px-4" space="md">
            <HStack className="w-full" space="md">
              {/* Amount Input */}
              <View className="flex-1">
                <Text className="text-xs text-typography-300 mb-1">
                  Amount (oz)
                </Text>
                <Input>
                  <InputField
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                </Input>
              </View>

              {/* Drink Type Select */}
              <View className="flex-1">
                <Text className="text-xs text-typography-500 mb-1">
                  Drink Type
                </Text>
                <Select
                  selectedValue={drinkType}
                  onValueChange={(value: string) =>
                    setDrinkType(value as DrinkType)
                  }
                >
                  <SelectTrigger variant="outline" size="md" className="justify-between">
                    <SelectInput placeholder="Select drink" />
                    <SelectIcon as={ChevronDownIcon} className="mx-2"/>
                  </SelectTrigger>
                  <SelectPortal>
                    <SelectBackdrop />
                    <SelectContent style={{ paddingBottom: 30 }}>
                      <SelectDragIndicatorWrapper>
                        <SelectDragIndicator />
                      </SelectDragIndicatorWrapper>
                      {DRINK_OPTIONS.map((option) => (
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
              className={`w-full bg-primary-0 ${!amount ? "opacity-70" : ""}`}
              onPress={async() => {
                if (amount) {
                    await logWaterIntake(amount, drinkType);
                    onLog(amount, drinkType);
                    Keyboard.dismiss();
                    handleClose();
                }
            }}
              isDisabled={!amount}
            >
              <ButtonText className="font-medium text-white">
                Log Drink
              </ButtonText>
            </Button>
          </VStack>
        </View>
      </ActionsheetContent>
    </Actionsheet>
  );
};
