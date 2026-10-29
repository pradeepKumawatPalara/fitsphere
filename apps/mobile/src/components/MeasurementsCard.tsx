import { Button, StyleSheet, Text, View } from 'react-native';

// The measurements prompt (REQ-HOME-008). Home shows it until both waist values are logged for the
// selected date's Mon–Sun week (Q-026; MVP default, D-23); it opens the measurements sheet.
export function MeasurementsCard({ onOpen }: { onOpen(): void }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Measurements</Text>
      <Text>Log your upper and lower waist once a week.</Text>
      <Button title="Add measurements" onPress={onOpen} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 12, backgroundColor: '#f1f5fb', gap: 8 },
  title: { color: '#555' },
});
