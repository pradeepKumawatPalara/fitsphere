import { istToday } from '@fitsphere/shared';
import { StyleSheet } from 'react-native';
import { Text } from './ui';

// Today's IST date from the phone's UTC clock, whatever time zone the phone is set to
// (invariant #5, REQ-DATE-004).
export function TodayIst() {
  return <Text style={styles.today}>Today (IST): {istToday()}</Text>;
}

const styles = StyleSheet.create({
  today: { fontSize: 16 },
});
