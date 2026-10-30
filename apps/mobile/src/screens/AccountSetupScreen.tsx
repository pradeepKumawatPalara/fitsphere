import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Button } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { ensureAccount } from '../auth/service';
import { TEXTS } from '../auth/texts';
import { CheckBox, Message, Screen, Text } from '../components/ui';
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
      <Text accessibilityRole="header">Set up your account</Text>
      <CheckBox label={TEXTS.ageConfirmation} checked={adult} onChange={setAdult} />
      <Message text={message} />
      <Button title="Continue" disabled={!adult || busy} onPress={() => void submit()} />
    </Screen>
  );
}
