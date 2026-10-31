import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Button, ScrollView, View } from 'react-native';
import { deleteAccount } from '../api/account';
import { useAuth } from '../auth/AuthProvider';
import { signOutLocally } from '../auth/service';
import { TEXTS } from '../auth/texts';
import { Message, Text } from '../components/ui';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { themedStyles, useTheme } from '../theme';

// Delete account (REQ-ACC-009; Q-048 MVP default; ADR-0004 rule 7; MVP defaults, D-S1): a separate
// screen that says what is deleted, then a confirmation. Online only. The server deletes the user's
// data, files and sign-in account; then this phone deletes its database and signs out.
export function DeleteAccountScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
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

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.title}>
        Delete your account
      </Text>
      <Text>Deleting your account deletes, for good:</Text>
      <Text>• your sign-in account: your email address and password;</Text>
      <Text>• everything you logged: weights, steps, sleep, measurements, meals and their photos, saved meals, workouts and targets;</Text>
      <Text>• your settings and your AI meal reading choices.</Text>
      <Text>It can't be undone. Anything on this phone that isn't on the server yet is deleted too.</Text>
      <Message text={message} />
      {confirming ? (
        <View accessibilityRole="alert" style={styles.confirm}>
          <Text>Delete your account? This can't be undone.</Text>
          <View style={styles.actions}>
            <Button title="Delete" color={colors.error} disabled={busy} onPress={() => void deleteNow()} />
            <Button title="Keep my account" disabled={busy} onPress={() => setConfirming(false)} />
          </View>
        </View>
      ) : (
        <Button title="Delete my account" color={colors.error} onPress={() => setConfirming(true)} />
      )}
    </ScrollView>
  );
}

const useStyles = themedStyles((c) => ({
  content: { padding: 16, gap: 12 },
  title: { fontSize: 18, fontWeight: '600' },
  confirm: { gap: 12, padding: 12, borderWidth: 1, borderColor: c.error, borderRadius: 6 },
  actions: { flexDirection: 'row', gap: 12 },
}));
