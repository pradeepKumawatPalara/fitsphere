import { useRouter } from 'expo-router';
import { Mail } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { requestPasswordReset } from '../auth/service';
import { emailProblem, TEXTS } from '../auth/texts';
import { DisplayHeading } from '../components/DisplayHeading';
import { FormScreen } from '../components/FormScreen';
import { Banner, Field, Message, TextButton } from '../components/ui';
import { Wordmark } from '../components/Wordmark';
import { themedStyles } from '../theme';
import { backToSignIn } from './navigation';

// REQ-ACC-010, D-11: the same neutral text whether or not the address is registered. The redesign's
// screen 1.5 (locked by the owner, 2026-11-03): a problem with the email shows under it; once the
// link is sent, the text shows in a banner in the field's place.
export function ForgotPasswordScreen() {
  const styles = useStyles();
  const { deps } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    setMessage(null);
    const problem = emailProblem(email);
    setEmailError(problem);
    if (problem) return;
    setBusy(true);
    const result = await requestPasswordReset(deps, email);
    setBusy(false);
    if (result === 'offline') setMessage(TEXTS.needsInternet('Resetting a password'));
    else setSent(true);
  }

  // As Sign in: the form scrolls to the field being typed in; the footer, with its button, rides
  // above the keyboard. Once the link is sent, going back to sign in is the step left.
  return (
    <FormScreen
      contentStyle={[styles.content, busy && styles.busy]}
      footer={
        sent ? (
          <TextButton title="Back to sign in" filled onPress={() => backToSignIn(router)} />
        ) : (
          <>
            <Message text={message} offline={message === TEXTS.needsInternet('Resetting a password')} />
            <TextButton title="Send reset link" filled arrow busy={busy} onPress={() => void submit()} />
            <TextButton title="Back to sign in" outlined wide onPress={() => backToSignIn(router)} />
          </>
        )
      }
    >
      <Wordmark />
      <DisplayHeading text="Forgot password" style={styles.heading} />
      <View style={styles.below}>
        {sent ? (
          <Banner tone="info" icon={Mail} text={TEXTS.resetSent} />
        ) : (
          <Field
            label="Email"
            error={emailError}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoComplete="email"
          />
        )}
      </View>
    </FormScreen>
  );
}

// As Sign in: from the wordmark, 48 to the heading and 40 to the field or the banner.
const useStyles = themedStyles(() => ({
  content: { paddingTop: 24, gap: 0 },
  busy: { opacity: 0.6 },
  heading: { marginTop: 48 },
  below: { marginTop: 40 },
}));
