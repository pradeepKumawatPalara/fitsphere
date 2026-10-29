import { StyleSheet, View } from 'react-native';
import { checkApiHealth } from '../api/health';
import { ApiStatus } from '../components/ApiStatus';
import { TodayIst } from '../components/TodayIst';
import { API_URL } from '../config';

export default function HomeScreen() {
  return (
    <View style={styles.screen}>
      <TodayIst />
      <ApiStatus apiUrl={API_URL} check={checkApiHealth} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24, padding: 16 },
});
