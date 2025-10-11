import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import React, { useState } from 'react';

const UnitPicker = () => {
   const [unitOneSelected, setUnitOneSelected] = useState(true);
   return (
      <View style={[styles.container]}>
         <TouchableOpacity
            style={[styles.unitContainer, unitOneSelected && { backgroundColor: 'white' }]}
            onPress={() => setUnitOneSelected(true)}>
            <Text style={[styles.text, unitOneSelected && { color: 'black' }]}>UNIT 1</Text>
         </TouchableOpacity>
         <TouchableOpacity
            style={[styles.unitContainer, !unitOneSelected && { backgroundColor: 'white' }]}
            onPress={() => setUnitOneSelected(false)}>
            <Text style={[styles.text, !unitOneSelected && { color: 'black' }]}>UNIT 2</Text>
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
      marginHorizontal: 16,
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
