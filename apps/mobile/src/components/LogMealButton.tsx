import type { IstDay } from '@fitsphere/shared';
import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import { themedStyles } from '../theme';
import { Text } from './ui';

// The floating "+" on Home and Nutrition (REQ-NAV-003). It opens Log meal on the selected date
// (Q-011) and logs meals only (Q-012).
export function LogMealButton({ day }: { day: IstDay }) {
  const styles = useStyles();
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

const useStyles = themedStyles((c) => ({
  button: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  plus: { color: c.onPrimary, fontSize: 30, lineHeight: 32 },
}));
