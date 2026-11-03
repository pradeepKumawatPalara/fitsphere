import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../components/ui';
import { useTheme } from '../theme';

/** A Progress card: a titled panel in the theme's surface colour. */
export function Card({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

// As Home's panels: r12, 12 between the parts of a card, titles 15 semi-bold.
const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 12, gap: 12 },
  title: { fontSize: 15, fontWeight: '600' },
});
