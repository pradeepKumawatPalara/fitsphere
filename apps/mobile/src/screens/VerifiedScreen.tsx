import { useLocalSearchParams, useRouter } from 'expo-router';
import { CircleCheck, Unlink } from 'lucide-react-native';
import { View } from 'react-native';
import { DisplayHeading } from '../components/DisplayHeading';
import { FormScreen } from '../components/FormScreen';
import { Text, TextButton } from '../components/ui';
import { Wordmark } from '../components/Wordmark';
import { themedStyles, useTheme } from '../theme';

// The link's two outcomes, each a heading and its text. The words are the app's own; "Link expired"
// is the only heading the redesign added (1.4, D-35).
const OUTCOMES = {
  verified: { heading: 'Your email is verified', text: 'Sign in to continue.' },
  expired: {
    heading: 'Link expired',
    text: 'This link has expired or was already used. Sign in, or sign up again for a new link.',
  },
};

// Opened by the link in the verify email (fitsphere://verified). The link confirms the address;
// the app then asks the user to sign in (api-conventions, "Sign-in flows"). Supabase adds
// `error` when the link has expired or was used. The redesign's screen 1.4 (locked by the owner,
// 2026-11-03): a sage tile when verified, a caramel one when the link failed, with Sign in at the
// foot.
export function VerifiedScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { error } = useLocalSearchParams<{ error?: string }>();
  const outcome = error ? OUTCOMES.expired : OUTCOMES.verified;
  return (
    <FormScreen
      contentStyle={styles.content}
      footer={<TextButton title="Sign in" filled arrow onPress={() => router.replace('/sign-in')} />}
    >
      <Wordmark />
      <View style={[styles.tile, error ? styles.tileExpired : styles.tileVerified]}>
        {error ? <Unlink size={34} color={colors.accent} /> : <CircleCheck size={34} color={colors.success} />}
      </View>
      <DisplayHeading text={outcome.heading} style={styles.heading} />
      <Text style={styles.body}>{outcome.text}</Text>
    </FormScreen>
  );
}

// As Check your email: from the wordmark, 48 to the tile, 24 to the heading, 16 to the text.
const useStyles = themedStyles((c) => ({
  content: { paddingTop: 24, gap: 0 },
  tile: { marginTop: 48, width: 72, height: 72, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  tileVerified: { backgroundColor: c.successTint },
  tileExpired: { backgroundColor: c.accentTint },
  heading: { marginTop: 24 },
  body: { marginTop: 16, maxWidth: 330, fontSize: 16, lineHeight: 24 },
}));
