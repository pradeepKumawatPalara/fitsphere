import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { deleteAccount } from '../api/account';
import { useAuth } from '../auth/AuthProvider';
import { signOutLocally } from '../auth/service';
import { TEXTS } from '../auth/texts';
import { Message, Text, TextButton } from '../components/ui';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { themedStyles } from '../theme';

// Delete account (REQ-ACC-009; Q-048 MVP default; ADR-0004 rule 7; MVP defaults, D-31): a separate
// screen that says what is deleted, then a confirmation. Online only. The server deletes the user's
// data, files and sign-in account; then this phone deletes its database and signs out.
export function DeleteAccountScreen() {
  const styles = useStyles();
  const { deps } = useAuth();
  const local = useLocalDatabase();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function deleteNow() {
    setBusy(true);
    setMessage(null);
    const result = await deleteAccount(deps);
    if (result === 'deleted') {
      await local.remove();
      await signOutLocally(deps);
      router.replace({ pathname: '/sign-in', params: { notice: 'accountDeleted' } });
      return;
    }
    setBusy(false);
    setConfirming(false);
    setMessage(result === 'offline' ? TEXTS.needsInternet('Deleting your account') : TEXTS.deleteFailed);
  }

  // Destructive actions are red and never filled; in the confirmation, keeping the account weighs the
  // same as deleting it. No fixed footer, so Delete is never pinned in reach.
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.title}>
        Delete your account
      </Text>
      <View style={styles.group}>
        <View style={styles.panel}>
          <Text style={styles.body}>Deleting your account deletes, for good:</Text>
          <Text style={styles.body}>• your sign-in account: your email address and password;</Text>
          <Text style={styles.body}>
            • everything you logged: weights, steps, sleep, measurements, meals and their photos, saved meals, workouts and targets;
          </Text>
          <Text style={styles.body}>• your settings and your AI meal reading choices.</Text>
        </View>
        <Text style={styles.warning}>It can't be undone. Anything on this phone that isn't on the server yet is deleted too.</Text>
      </View>
      <Message text={message} />
      {confirming ? (
        <View accessibilityRole="alert" style={styles.confirm}>
          <Text style={styles.body}>Delete your account? This can't be undone.</Text>
          <View style={styles.actions}>
            <View style={styles.half}>
              <TextButton title="Keep my account" outlined wide disabled={busy} onPress={() => setConfirming(false)} />
            </View>
            <View style={styles.half}>
              <TextButton title="Delete" outlined wide destructive disabled={busy} onPress={() => void deleteNow()} />
            </View>
          </View>
        </View>
      ) : (
        <TextButton title="Delete my account" outlined destructive onPress={() => setConfirming(true)} />
      )}
    </ScrollView>
  );
}

// Spacing as on Home: 24 between groups, 12 within one.
const useStyles = themedStyles((c) => ({
  content: { padding: 16, paddingTop: 24, gap: 24 },
  title: { fontSize: 30, fontWeight: '700', letterSpacing: -0.5 },
  group: { gap: 12 },
  panel: { padding: 16, borderRadius: 12, backgroundColor: c.surface, gap: 8 },
  body: { fontSize: 15 },
  warning: { fontSize: 15, fontWeight: '600' },
  confirm: { gap: 12, padding: 14, borderWidth: 1.5, borderColor: c.danger, borderRadius: 12 },
  // The way out on the left, the red action on the right, the same size.
  actions: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
}));
