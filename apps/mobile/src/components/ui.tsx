import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

export function Screen({ children }: { children: ReactNode }) {
  return <View style={styles.screen}>{children}</View>;
}

export function Field({ label, ...input }: { label: string } & TextInputProps) {
  return (
    <View style={styles.field}>
      <Text>{label}</Text>
      <TextInput accessibilityLabel={label} style={styles.input} autoCapitalize="none" {...input} />
    </View>
  );
}

export function CheckBox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={styles.checkRow}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>{checked ? <Text style={styles.tick}>✓</Text> : null}</View>
      <Text>{label}</Text>
    </Pressable>
  );
}

export function Message({ text }: { text: string | null }) {
  return text ? (
    <Text accessibilityRole="alert" style={styles.message}>
      {text}
    </Text>
  ) : null;
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24, gap: 16, justifyContent: 'center' },
  field: { gap: 4 },
  input: { borderWidth: 1, borderColor: '#999', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  box: { width: 24, height: 24, borderWidth: 2, borderColor: '#555', borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  boxChecked: { backgroundColor: '#1565c0', borderColor: '#1565c0' },
  tick: { color: '#fff', fontWeight: '700' },
  message: { color: '#b00020' },
});
