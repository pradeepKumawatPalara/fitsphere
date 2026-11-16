import type { IstDay } from '@fitsphere/shared';
import { CircleAlert, History, LoaderCircle, WifiOff } from 'lucide-react-native';
import { View } from 'react-native';
import { formatDay } from '../format';
import type { OlderDaysStatus } from '../sync/olderDays';
import { themedStyles, useTheme } from '../theme';
import { Text, TextButton } from './ui';

/** What the banner says while a day before the phone's 90 is not shown yet (D-106). */
export const OLDER_DAY_TEXTS = {
  loading: 'Loading this day…',
  offline: 'This day is more than 90 days ago. Connect to the internet to see it.',
  failed: 'Couldn’t load this day.',
} as const;

/** Whether a day's data is not on the phone yet: its cards show dashes, not "nothing logged" (D-106). */
export function isWaiting(status: OlderDaysStatus): status is 'loading' | 'offline' | 'failed' {
  return status === 'loading' || status === 'offline' || status === 'failed';
}

type Props = {
  day: IstDay;
  today: IstDay;
  /** How the day stands: a day before the phone's 90 adds a line while it is not shown yet (D-106). */
  status: OlderDaysStatus;
  onBack(): void;
  onRetry(): void;
};

// "Showing <date>" with Back to today, on Home, Nutrition and Training for a day other than today
// (REQ-DATE-001). A day before the phone's 90 (D-106, canvas "2.2 Calendar and 2.3 Home · older days",
// approved by the owner 2026-11-16) carries its year when it is of another year, and while it is not
// shown yet a second line under a rule: loading, offline, or not loaded with Try again.
export function ShowingDayBanner({ day, today, status, onBack, onRetry }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const waiting = isWaiting(status) ? status : null;
  return (
    <View style={styles.banner}>
      <View style={styles.row}>
        <History size={20} color={colors.accent} />
        <Text style={styles.text}>Showing {formatDay(day, today)}</Text>
        <TextButton title="Back to today" onPress={onBack} />
      </View>
      {waiting ? (
        <View accessibilityLiveRegion="polite" style={styles.status}>
          {waiting === 'loading' ? <LoaderCircle size={20} strokeWidth={2.25} color={colors.accent} /> : null}
          {waiting === 'offline' ? <WifiOff size={20} color={colors.inkMuted} /> : null}
          {waiting === 'failed' ? <CircleAlert size={20} color={colors.danger} /> : null}
          <Text accessibilityRole={waiting === 'failed' ? 'alert' : 'text'} style={[styles.statusText, waiting === 'failed' && styles.failed]}>
            {OLDER_DAY_TEXTS[waiting]}
          </Text>
          {waiting === 'failed' ? <TextButton title="Try again" onPress={onRetry} /> : null}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  banner: { paddingLeft: 14, paddingRight: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: c.accentTint },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  text: { flex: 1, fontSize: 15, lineHeight: 22 },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  statusText: { flex: 1, fontSize: 14, lineHeight: 20, color: c.inkMuted },
  failed: { color: c.danger },
}));
