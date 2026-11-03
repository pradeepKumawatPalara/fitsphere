import { useContext, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, ScrollView, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { themedStyles } from '../theme';
import { TYPE } from '../typography';
import { StripeCorner } from './StripeCorner';
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
// The redesign's frame (D-35, with 2.2): a card-coloured sheet with a grab handle, the stripe corner
// at its top right, and its title in condensed capitals.
export function Sheet({ title, header, children, actions, scroll = true, onClose }: Props) {
  const styles = useStyles();
  // None outside the app (tests).
  const bottom = useContext(SafeAreaInsetsContext)?.bottom ?? 0;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={-bottom} style={styles.backdrop}>
        <View style={styles.sheet}>
          <StripeCorner />
          <View style={styles.handle} />
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

// 16 at the sides, as the tab screens; 12 between the parts of the body, 8 between the actions. The
// main action is filled, Cancel and Close are links.
const useStyles = themedStyles((c) => ({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: c.scrim },
  sheet: {
    maxHeight: '90%',
    overflow: 'hidden',
    backgroundColor: c.surface,
    paddingTop: 10,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 18, backgroundColor: c.inkSubtle },
  header: { paddingHorizontal: 16, paddingBottom: 12 },
  title: TYPE.sheetTitle,
  // The body gives way first when the keyboard leaves little room.
  scroll: { flexGrow: 0 },
  body: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  list: { flexShrink: 1 },
  actions: { paddingHorizontal: 16, paddingTop: 12, gap: 8, backgroundColor: c.surface },
}));
