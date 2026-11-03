import type { IstDay } from '@fitsphere/shared';
import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { Pressable } from 'react-native';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { Text } from './ui';

// The floating "+ LOG" on Home and Nutrition (REQ-NAV-003; the redesign's 2.3, locked by the owner
// 2026-11-03). It opens Log meal on the selected date (Q-011) and logs meals only (Q-012); screen
// readers hear "Log a meal".
export function LogMealButton({ day }: { day: IstDay }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Log a meal"
      onPress={() => router.push({ pathname: '/log-meal', params: { day } })}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Plus size={22} strokeWidth={2.75} color={colors.onPrimary} />
      <Text style={styles.log}>Log</Text>
    </Pressable>
  );
}

const useStyles = themedStyles((c) => ({
  button: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 14,
    paddingRight: 18,
    borderRadius: 8,
    backgroundColor: c.primary,
    elevation: 6,
  },
  pressed: { backgroundColor: c.primaryPressed },
  log: { ...TYPE.button, color: c.onPrimary },
}));
