import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { signOutLocally } from '../auth/service';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { logOutDecision } from '../local/store';

// Log out (REQ-ACC-008; MVP default, D-18): deletes the phone's database and its key. With entries
// not yet on the server, the app warns first and deletes them only if the user confirms.
export function LogOut() {
  const { deps } = useAuth();
  const local = useLocalDatabase();
  const router = useRouter();
  const [unsynced, setUnsynced] = useState<number | null>(null);

  async function logOut(confirmed: boolean) {
    if (!confirmed && local.state.status === 'ready') {
      const decision = await logOutDecision(local.state.db);
      if (decision.kind === 'warn') {
        setUnsynced(decision.unsynced);
        return;
      }
    }
    await local.remove();
    await signOutLocally(deps);
    router.replace('/sign-in');
  }

  if (unsynced === null) return <Button title="Log out" onPress={() => void logOut(false)} />;
  return (
    <View style={styles.warning} accessibilityRole="alert">
      <Text>
        {unsynced === 1 ? '1 entry is' : `${unsynced} entries are`} not on the server yet. If you log out now, they are
        deleted from this phone.
      </Text>
      <Button title="Stay signed in" onPress={() => setUnsynced(null)} />
      <Button title="Log out and delete them" onPress={() => void logOut(true)} />
    </View>
  );
}

const styles = StyleSheet.create({
  warning: { gap: 12, padding: 12, borderWidth: 1, borderColor: '#b00020', borderRadius: 6 },
});
