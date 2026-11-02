import { useContext, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { themedStyles } from '../theme';
import { Text } from './ui';

type Props = {
  /** The sheet's heading; or `header`, for a heading row with more in it. */
  title?: string;
  header?: ReactNode;
  children?: ReactNode;
  /** Fixed at the foot of the sheet, so they stay above the keyboard: the main action first. */
  actions?: ReactNode;
  /** False when the body is a list that scrolls itself (Search foods). */
  scroll?: boolean;
  onClose(): void;
};

// The frame of every sheet with a text field. A sheet is drawn edge to edge, and Android doesn't
// resize such a window for the keyboard, so the sheet is lifted above the keyboard here: the body
// scrolls to the field being typed in and the actions stay fixed under it. Their padding clears the
// navigation bar; with the keyboard up the bar is behind it, so the offset takes that padding back.
export function Sheet({ title, header, children, actions, scroll = true, onClose }: Props) {
  const styles = useStyles();
  // None outside the app (tests).
  const bottom = useContext(SafeAreaInsetsContext)?.bottom ?? 0;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={-bottom} style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            {title !== undefined ? (
              <Text accessibilityRole="header" style={styles.title}>
                {title}
              </Text>
            ) : null}
            {header}
          </View>
          {scroll ? (
            <ScrollView style={styles.scroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          ) : (
            <View style={[styles.body, styles.list]}>{children}</View>
          )}
          {actions ? <View style={[styles.actions, { paddingBottom: 16 + bottom }]}>{actions}</View> : <View style={{ height: 16 + bottom }} />}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = themedStyles((c) => ({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: { maxHeight: '90%', backgroundColor: c.background, paddingTop: 20, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  header: { paddingHorizontal: 20, paddingBottom: 8 },
  title: { fontSize: 18, fontWeight: '600' },
  // The body gives way first when the keyboard leaves little room.
  scroll: { flexGrow: 0 },
  body: { paddingHorizontal: 20, paddingBottom: 12, gap: 10 },
  list: { flexShrink: 1 },
  actions: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    backgroundColor: c.background,
  },
}));
