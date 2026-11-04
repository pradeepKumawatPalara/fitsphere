import { useContext, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { themedStyles } from '../theme';

// A screen opened over another (Search foods, D-44; a food's page, D-45). It is drawn edge to edge, as
// the sheets are, so it clears the status and navigation bars itself, and it is lifted above the
// keyboard; its `footer`, the main action, stays fixed above the keyboard. As in the sheets, the
// keyboard's offset takes back the navigation bar's padding, which the keyboard covers.
export function FullScreen({ onClose, children, footer }: { onClose(): void; children: ReactNode; footer?: ReactNode }) {
  const styles = useStyles();
  // None outside the app (tests).
  const insets = useContext(SafeAreaInsetsContext);
  const top = insets?.top ?? 0;
  const bottom = insets?.bottom ?? 0;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={-bottom} style={styles.screen}>
        <View style={[styles.frame, { paddingTop: top, paddingBottom: footer ? 0 : bottom }]}>
          {children}
          {footer ? <View style={[styles.footer, { paddingBottom: 16 + bottom }]}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = themedStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.bg },
  frame: { flex: 1 },
  footer: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: c.bg },
}));
