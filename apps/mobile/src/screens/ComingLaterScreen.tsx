import { StyleSheet, View } from 'react-native';
import { Text } from '../components/ui';

// A tab whose slice is not built yet (MVP default, D-23).
export function ComingLaterScreen() {
  return (
    <View style={styles.screen}>
      <Text>Coming in a later update.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
