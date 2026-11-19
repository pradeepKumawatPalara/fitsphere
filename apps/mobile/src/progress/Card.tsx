import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from '../components/ui';
import { themedStyles } from '../theme';
import { TYPE } from '../typography';

/** A Progress card: a titled panel in the theme's surface colour. */
export function Card({ title, action, children }: { title: string; /** A control on the heading's row, at its end. */ action?: ReactNode; children: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.card}>
      {action ? (
        <View style={styles.head}>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          {action}
        </View>
      ) : (
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
      )}
      {children}
    </View>
  );
}

// The redesign's 5.1 (locked by the owner, 2026-11-03), as Home's panels (2.3): square corners, the
// title in muted condensed capitals, 12 between the parts of a card.
const useStyles = themedStyles((c) => ({
  card: { padding: 12, borderRadius: 4, gap: 10, backgroundColor: c.surface },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { ...TYPE.label, color: c.inkMuted },
}));
