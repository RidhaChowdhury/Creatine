import React from "react";
import { TouchableOpacity, Text } from "react-native";
import { LucideIcon } from "lucide-react-native";

type SettingsRowProps = {
  label: string;
  Icon: LucideIcon;
  onPress?: () => void;
};

export function SettingsRow({ label, Icon, onPress }: SettingsRowProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row items-center bg-neutral-800 rounded-lg px-4 py-3 mb-2 h-[65px]"
    >
      <Icon size={20} color="white" />
      <Text className="ml-3 text-white text-[18px]">{label}</Text>
    </TouchableOpacity>
  );
}
