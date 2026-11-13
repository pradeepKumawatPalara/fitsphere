import { useLocalSearchParams, useRouter } from 'expo-router';
import { Unlink, WifiOff } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { setNewPassword, startPasswordReset } from '../auth/service';
import { passwordProblem, TEXTS } from '../auth/texts';
import { DisplayHeading } from '../components/DisplayHeading';
import { FormScreen } from '../components/FormScreen';
import { Banner, ButtonHint, Field, Message, TextButton } from '../components/ui';
import { Wordmark } from '../components/Wordmark';
import { useFieldChecks } from '../fieldChecks';
import { themedStyles, useTheme } from '../theme';

// "Set a new password", opened by the link in the reset email, fitsphere://reset-password
// (REQ-ACC-010, D-11). The redesign's screen 1.6 (locked by the owner, 2026-11-03): every state
// under the same heading. While the link is checked, a spinner; a link that can't be used, or no
// internet to check it, shows as a banner with Forgot password at the foot. The password's rule
// shows under it as on Sign up; a reused password is named under the field, anything else above
// Set password.
export function ResetPasswordScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { deps } = useAuth();
  const router = useRouter();
  const { code, error } = useLocalSearchParams<{ code?: string; error?: string }>();
  const [link, setLink] = useState<'checking' | 'ready' | 'invalid' | 'offline'>('checking');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const ruleMet = passwordProblem(password) === null;
  // The rule shows once typing pauses or the field is left; Set password waits (D-99).
  const checks = useFieldChecks({ password });

  useEffect(() => {
    let active = true;
    void startPasswordReset(deps, error ? undefined : code).then((result) => {
      if (active) setLink(result);
    });
    return () => {
      active = false;
    };
  }, [deps, code, error]);

  async function submit() {
    setMessage(null);
    setPasswordError(null);
    if (!ruleMet) return;
    setBusy(true);
    const result = await setNewPassword(deps, password);
    setBusy(false);
    if (result === 'changed') router.replace('/home');
    else if (result === 'offline') setMessage(TEXTS.needsInternet('Setting a new password'));
    else if (result === 'samePassword') setPasswordError(TEXTS.samePassword);
    else setMessage(TEXTS.tryLater);
  }

  const linkFailed = link === 'invalid' || link === 'offline';
  // As Sign in: the form scrolls to the field being typed in; the footer, with its button, rides
  // above the keyboard.
  return (
    <FormScreen
      contentStyle={[styles.content, busy && styles.busy]}
      footer={
        linkFailed ? (
          <TextButton title="Forgot password" filled arrow onPress={() => router.replace('/forgot-password')} />
        ) : link === 'ready' ? (
          <>
            <Message text={message} offline={message === TEXTS.needsInternet('Setting a new password')} />
            <TextButton title="Set password" filled arrow busy={busy} disabled={!ruleMet} onPress={() => void submit()} />
            {ruleMet ? null : <ButtonHint text="Use 8 to 72 characters for the new password." />}
          </>
        ) : null
      }
    >
      <Wordmark />
      <DisplayHeading text="Set a new password" style={styles.heading} />
      {link === 'checking' ? (
        <View style={styles.checking}>
          <ActivityIndicator size="large" color={colors.accent} accessibilityLabel="Checking the link" />
        </View>
      ) : linkFailed ? (
        <View style={styles.below}>
          <Banner
            tone="error"
            icon={link === 'offline' ? WifiOff : Unlink}
            text={link === 'offline' ? TEXTS.needsInternet('Resetting a password') : TEXTS.resetLinkInvalid}
          />
        </View>
      ) : (
        <View style={styles.below}>
          <Field
            label="New password"
            error={passwordError ?? (checks.shows('password') && !ruleMet ? TEXTS.passwordRule : null)}
            rule={{ text: TEXTS.passwordRule, met: ruleMet }}
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setPasswordError(null);
            }}
            onFocus={() => checks.focus('password')}
            onBlur={() => checks.blur('password')}
            secureTextEntry
            autoComplete="new-password"
          />
        </View>
      )}
    </FormScreen>
  );
}

// As Sign in: from the wordmark, 48 to the heading and 40 to the field or the banner.
const useStyles = themedStyles(() => ({
  content: { paddingTop: 24, gap: 0 },
  busy: { opacity: 0.6 },
  heading: { marginTop: 48 },
  below: { marginTop: 40 },
  checking: { marginTop: 56, alignItems: 'center' },
}));
