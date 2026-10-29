import type { IstDay } from '@fitsphere/shared';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

// The floating "+" on Home and Nutrition (REQ-NAV-003). It opens Log meal on the selected date
// (Q-011) and logs meals only (Q-012).
export function LogMealButton({ day }: { day: IstDay }) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Log a meal"
      onPress={() => router.push({ pathname: '/log-meal', params: { day } })}
      style={styles.button}
    >
      <Text style={styles.plus}>+</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1565c0',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  plus: { color: '#fff', fontSize: 30, lineHeight: 32 },
});
