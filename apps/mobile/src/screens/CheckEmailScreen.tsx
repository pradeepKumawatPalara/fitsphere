import { useRouter } from 'expo-router';
import { Mail } from 'lucide-react-native';
import { View } from 'react-native';
import { TEXTS } from '../auth/texts';
import { DisplayHeading } from '../components/DisplayHeading';
import { FormScreen } from '../components/FormScreen';
import { Text, TextButton } from '../components/ui';
import { Wordmark } from '../components/Wordmark';
import { themedStyles, useTheme } from '../theme';
import { backToSignIn } from './navigation';

// After sign-up, the same neutral text whatever Supabase returned (REQ-ACC-010, D-11). The redesign's
// screen 1.3 (locked by the owner, 2026-11-03): a mail tile, "CHECK YOUR / EMAIL" and the text, with
// Back to sign in at the foot.
export function CheckEmailScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <FormScreen
      contentStyle={styles.content}
      footer={<TextButton title="Back to sign in" filled onPress={() => backToSignIn(router)} />}
    >
      <Wordmark />
      <View style={styles.tile}>
        <Mail size={34} color={colors.accent} />
      </View>
      <DisplayHeading text={TEXTS.signUpSentHeading} style={styles.heading} />
      <Text style={styles.body}>{TEXTS.signUpSent}</Text>
    </FormScreen>
  );
}

// As Sign in: from the wordmark, 48 to the tile, 24 to the heading, 16 to the text.
const useStyles = themedStyles((c) => ({
  content: { paddingTop: 24, gap: 0 },
  tile: { marginTop: 48, width: 72, height: 72, borderRadius: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accentTint },
  heading: { marginTop: 24 },
  body: { marginTop: 16, maxWidth: 330, fontSize: 16, lineHeight: 24 },
}));
