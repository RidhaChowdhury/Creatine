import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import React, { useState } from 'react';

type UnitPickerProps = {
   unitOne: string;
   unitTwo: string;
};

const UnitPicker = (props: UnitPickerProps) => {
   const { unitOne, unitTwo } = props;
   const [unitOneSelected, setUnitOneSelected] = useState(true);
   return (
      <View style={[styles.container]}>
         <TouchableOpacity
            style={[styles.unitContainer, unitOneSelected && { backgroundColor: 'white' }]}
            onPress={() => setUnitOneSelected(true)}>
            <Text style={[styles.text, unitOneSelected && { color: 'black' }]}>{unitOne}</Text>
         </TouchableOpacity>
         <TouchableOpacity
            style={[styles.unitContainer, !unitOneSelected && { backgroundColor: 'white' }]}
            onPress={() => setUnitOneSelected(false)}>
            <Text style={[styles.text, !unitOneSelected && { color: 'black' }]}>{unitTwo}</Text>
         </TouchableOpacity>
      </View>
   );
};

export default UnitPicker;

const styles = StyleSheet.create({
   container: {
      flexDirection: 'row',
      borderColor: 'gray',
      borderWidth: 0.5,
      borderRadius: 8,
      height: 65
   },
   unitContainer: {
      borderRadius: 8,
      width: '50%',
      alignItems: 'center',
      justifyContent: 'center'
   },
   text: {
      color: 'white',
      fontSize: 18
   }
});
