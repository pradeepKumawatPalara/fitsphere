import { useContext, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthProvider';
import { changePassword } from '../auth/service';
import { passwordProblem, TEXTS } from '../auth/texts';
import { Field, Message, Text, TextButton } from '../components/ui';
import { themedStyles } from '../theme';

// Change password (REQ-ACC-007; MVP default, D-31): the current password, then a new one of 8–72
// characters, as at sign-up. Online only. Afterwards the user's other devices are signed out.
export function ChangePasswordScreen() {
  const styles = useStyles();
  // The fixed footer clears the phone's navigation bar; none outside the app (tests).
  const insets = useContext(SafeAreaInsetsContext);
  const { deps, email } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);

  async function submit() {
    setChanged(false);
    if (!current) {
      setMessage(TEXTS.currentPasswordRequired);
      return;
    }
    const problem = passwordProblem(next);
    if (problem) {
      setMessage(problem);
      return;
    }
    if (!email) {
      setMessage(TEXTS.tryLater);
      return;
    }
    setBusy(true);
    setMessage(null);
    const result = await changePassword(deps, email, current, next);
    setBusy(false);
    if (result === 'changed') {
      setCurrent('');
      setNext('');
      setChanged(true);
    } else {
      setMessage(
        result === 'wrongPassword'
          ? TEXTS.wrongCurrentPassword
          : result === 'samePassword'
            ? TEXTS.samePassword
            : result === 'offline'
              ? TEXTS.needsInternet('Changing your password')
              : TEXTS.tryLater,
      );
    }
  }

  // As on Sign in: the form scrolls to the field being typed in; the footer, with the button and what
  // happened, rides above the keyboard.
  return (
    <KeyboardAvoidingView behavior="padding" style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Field label="Current password" value={current} onChangeText={setCurrent} secureTextEntry autoComplete="current-password" />
        <Field label="New password" value={next} onChangeText={setNext} secureTextEntry autoComplete="new-password" />
        <Text style={styles.rule}>{TEXTS.passwordRule}</Text>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: 16 + (insets?.bottom ?? 0) }]}>
        <Message text={message} />
        {changed ? <Text accessibilityRole="alert">{TEXTS.passwordChanged}</Text> : null}
        <TextButton title="Change password" filled disabled={busy} onPress={() => void submit()} />
      </View>
    </KeyboardAvoidingView>
  );
}

const useStyles = themedStyles((c) => ({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24, gap: 12 },
  // The rule belongs to the new password: closer to it than the fields are to each other.
  rule: { marginTop: -6, fontSize: 13, color: c.textMuted },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    backgroundColor: c.background,
  },
}));
