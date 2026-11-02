import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { signOutLocally } from '../auth/service';
import { Text, TextButton } from '../components/ui';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { logOutDecision } from '../local/store';
import { themedStyles } from '../theme';

// Log out (REQ-ACC-008; MVP default, D-18): deletes the phone's database and its key. With entries
// not yet on the server, the app warns first and deletes them only if the user confirms.
export function LogOut() {
  const styles = useStyles();
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

  // Destructive, so red and never filled; in the warning, staying signed in weighs the same.
  if (unsynced === null) return <TextButton title="Log out" outlined destructive onPress={() => void logOut(false)} />;
  return (
    <View style={styles.warning} accessibilityRole="alert">
      <Text style={styles.text}>
        {unsynced === 1 ? '1 entry is' : `${unsynced} entries are`} not on the server yet. If you log out now, they are
        deleted from this phone.
      </Text>
      <TextButton title="Stay signed in" outlined onPress={() => setUnsynced(null)} />
      <TextButton title="Log out and delete them" outlined destructive onPress={() => void logOut(true)} />
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  warning: { gap: 12, padding: 14, borderWidth: 1.5, borderColor: c.over, borderRadius: 12 },
  text: { fontSize: 15 },
}));
