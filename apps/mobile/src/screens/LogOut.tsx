import { useRouter } from 'expo-router';
import { LogOut as LogOutIcon, TriangleAlert } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { signOutLocally } from '../auth/service';
import { Text, TextButton } from '../components/ui';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { logOutDecision } from '../local/store';
import { themedStyles, useTheme } from '../theme';

// Log out (REQ-ACC-008; MVP default, D-18): deletes the phone's database and its key. With entries
// not yet on the server, the app warns first and deletes them only if the user confirms. The
// redesign's 6.5 (locked by the owner, 2026-11-03, with 6.1): the warning takes the place of Log out
// and of what follows it (`after`, Delete account), on a red tint.
export function LogOut({ after }: { after?: ReactNode }) {
  const styles = useStyles();
  const { colors } = useTheme();
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

  // Destructive, so red and never filled; in the warning, staying signed in comes first and weighs
  // the same, both full width (the red label is too long to share a row).
  if (unsynced === null) {
    return (
      <View style={styles.leave}>
        <TextButton title="Log out" outlined wide destructive icon={LogOutIcon} onPress={() => void logOut(false)} />
        {after}
      </View>
    );
  }
  return (
    <View style={styles.warning} accessibilityRole="alert">
      <View style={styles.say}>
        <TriangleAlert size={20} color={colors.danger} />
        <Text style={styles.text}>
          {unsynced === 1 ? '1 entry is' : `${unsynced} entries are`} not on the server yet. If you log out now, they are
          deleted from this phone.
        </Text>
      </View>
      {/* On the tint, staying signed in sits on the card colour. */}
      <View style={styles.stay}>
        <TextButton title="Stay signed in" outlined wide onPress={() => setUnsynced(null)} />
      </View>
      <TextButton title="Log out and delete them" outlined wide destructive onPress={() => void logOut(true)} />
    </View>
  );
}

const useStyles = themedStyles((c) => ({
  leave: { gap: 4 },
  warning: { gap: 12, padding: 16, borderWidth: 1.5, borderColor: c.danger, borderRadius: 4, backgroundColor: c.dangerTint },
  say: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  text: { flex: 1, fontSize: 15, lineHeight: 22 },
  stay: { borderRadius: 4, backgroundColor: c.surface },
}));
