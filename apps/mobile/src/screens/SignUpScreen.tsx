import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { signUp } from '../auth/service';
import { emailProblem, passwordProblem, TEXTS } from '../auth/texts';
import { FormScreen } from '../components/FormScreen';
import { CheckBox, Field, Message, Text, TextButton } from '../components/ui';
import { themedStyles } from '../theme';

// REQ-ACC-010, D-18: sign-up needs "I am 18 or older"; the result is always the neutral text.
export function SignUpScreen() {
  const styles = useStyles();
  const { deps } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    const problem = emailProblem(email) ?? passwordProblem(password);
    if (problem) {
      setMessage(problem);
      return;
    }
    setBusy(true);
    setMessage(null);
    const result = await signUp(deps, email, password);
    setBusy(false);
    if (result === 'offline') setMessage(TEXTS.needsInternet('Signing up'));
    else router.replace('/check-email');
  }

  // As Sign in: the form scrolls to the field being typed in; the footer, with Sign up, rides above
  // the keyboard.
  return (
    <FormScreen
      contentStyle={styles.content}
      footer={
        <>
          <Message text={message} />
          <TextButton title="Sign up" filled disabled={!adult || busy} onPress={() => void submit()} />
          <TextButton title="I already have an account" wide onPress={() => router.replace('/sign-in')} />
        </>
      }
    >
      <Text accessibilityRole="header" style={styles.heading}>
        Create an account
      </Text>
      <View style={styles.fields}>
        <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
        <Text style={styles.rule}>{TEXTS.passwordRule}</Text>
      </View>
      <CheckBox label={TEXTS.ageConfirmation} checked={adult} onChange={setAdult} />
    </FormScreen>
  );
}

// As Sign in: 24 between groups, 12 within one.
const useStyles = themedStyles((c) => ({
  content: { paddingTop: 32, gap: 24 },
  heading: { fontSize: 30, fontWeight: '700', letterSpacing: -0.5 },
  fields: { gap: 12 },
  // The rule belongs to the password: closer to it than the fields are to each other.
  rule: { marginTop: -6, fontSize: 13, color: c.textMuted },
}));
