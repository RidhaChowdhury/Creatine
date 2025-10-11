import { View, Text, TextInput, StyleSheet, KeyboardTypeOptions } from 'react-native';
import React, { useState } from 'react';
import { useAppSelector } from '@/store/hooks';

type SettingsInputFieldProps = {
   label: string;
   field: string;
   bottomSeperator?: boolean;
   value: string | undefined;
   setFunction: React.Dispatch<React.SetStateAction<any>>;
   onChangeText: any;
   keyboardType?: KeyboardTypeOptions;
};

const SettingsInputField = ({
   label,
   field,
   bottomSeperator,
   value,
   setFunction,
   onChangeText,
   keyboardType = 'default'
}: SettingsInputFieldProps) => {

   return (
      <View
         style={[
            styles.container,
            bottomSeperator && { borderBottomWidth: 1, borderBottomColor: '#262626' }
         ]}>
         <Text style={styles.label}>{label}</Text>
         <TextInput
            value={value}
            onChangeText={(text) => onChangeText(setFunction, text, field)}
            style={styles.input}
            keyboardType={keyboardType}
         />
      </View>
   );
};

const styles = StyleSheet.create({
   container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      height: 65
   },
   label: {
      color: '#fff',
      fontSize: 18
   },
   input: {
      color: '#fff',
      fontSize: 18,
      marginLeft: 24,
      flex: 1
   }
});

export default SettingsInputField;
