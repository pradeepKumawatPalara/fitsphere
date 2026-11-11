import { Calendar } from 'lucide-react-native';
import { View } from 'react-native';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { Text } from './ui';

/**
 * In place of "Set a target" on a past date, or a past week, that had no target (D-77): setting one
 * now starts today, so it would not change that day.
 */
export function NoTargetNote({ text = 'No target on this day' }: { text?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Calendar size={16} color={colors.inkSubtle} importantForAccessibility="no" accessibilityElementsHidden />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  text: { ...TYPE.small, color: c.inkMuted },
}));
