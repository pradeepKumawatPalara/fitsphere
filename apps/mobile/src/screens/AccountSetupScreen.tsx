import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { ensureAccount } from '../auth/service';
import { TEXTS } from '../auth/texts';
import { CheckBox, Message, Screen, Text, TextButton } from '../components/ui';
import { goAfterAccountCheck } from './navigation';

// Shown only when the user's metadata has no 18+ confirmation, e.g. an account made before the
// box existed (REQ-ACC-010, D-18).
export function AccountSetupScreen() {
  const { deps } = useAuth();
  const router = useRouter();
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setMessage(goAfterAccountCheck(router, await ensureAccount(deps, true), 'Setting up your account'));
    setBusy(false);
  }

  return (
    <Screen>
      <Text accessibilityRole="header" style={styles.heading}>
        Set up your account
      </Text>
      <CheckBox label={TEXTS.ageConfirmation} checked={adult} onChange={setAdult} />
      <Message text={message} />
      <TextButton title="Continue" filled disabled={!adult || busy} onPress={() => void submit()} />
      {adult ? null : <Text style={styles.hint}>{TEXTS.ageHint}</Text>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 30, fontWeight: '700', letterSpacing: -0.5 },
  hint: { marginTop: -12, fontSize: 13, textAlign: 'center' },
});
