import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { ensureAccount } from '../auth/service';
import { TEXTS } from '../auth/texts';
import { DisplayHeading } from '../components/DisplayHeading';
import { FormScreen } from '../components/FormScreen';
import { CheckBox, Message, Text, TextButton } from '../components/ui';
import { Wordmark } from '../components/Wordmark';
import { themedStyles } from '../theme';
import { TYPE } from '../typography';
import { goAfterAccountCheck } from './navigation';

// Shown only when the user's metadata has no 18+ confirmation, e.g. an account made before the
// box existed (REQ-ACC-010, D-18). The redesign's screen 1.7 (locked by the owner, 2026-11-03): the
// box under the heading, Continue at the foot with its hint until the box is ticked, and any
// problem above Continue.
export function AccountSetupScreen() {
  const styles = useStyles();
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
    <FormScreen
      contentStyle={[styles.content, busy && styles.busy]}
      footer={
        <>
          <Message text={message} offline={message === TEXTS.needsInternet('Setting up your account')} />
          <View style={styles.submit}>
            <TextButton title="Continue" filled arrow disabled={!adult} busy={busy} onPress={() => void submit()} />
            {adult ? null : <Text style={styles.hint}>{TEXTS.ageHint}</Text>}
          </View>
        </>
      }
    >
      <Wordmark />
      <DisplayHeading text="Set up your account" style={styles.heading} />
      <View style={styles.box}>
        <CheckBox label={TEXTS.ageConfirmation} checked={adult} onChange={setAdult} />
      </View>
    </FormScreen>
  );
}

// As Sign up: from the wordmark, 48 to the heading and 40 to the box; the hint close under Continue.
const useStyles = themedStyles((c) => ({
  content: { paddingTop: 24, gap: 0 },
  busy: { opacity: 0.6 },
  heading: { marginTop: 48 },
  box: { marginTop: 40 },
  submit: { gap: 8 },
  hint: { ...TYPE.small, color: c.inkMuted, textAlign: 'center' },
}));
