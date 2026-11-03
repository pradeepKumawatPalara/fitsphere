import { useRouter } from 'expo-router';
import { ClipboardList, KeyRound, SlidersHorizontal, Trash, TriangleAlert, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { deleteAccount } from '../api/account';
import { useAuth } from '../auth/AuthProvider';
import { signOutLocally } from '../auth/service';
import { TEXTS } from '../auth/texts';
import { Message, Text, TextButton } from '../components/ui';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';

// What deleting the account deletes, each with its icon.
const DELETED: { icon: LucideIcon; text: string }[] = [
  { icon: KeyRound, text: 'your sign-in account: your email address and password;' },
  {
    icon: ClipboardList,
    text: 'everything you logged: weights, steps, sleep, measurements, meals and their photos, saved meals, workouts and targets;',
  },
  { icon: SlidersHorizontal, text: 'your settings and your AI meal reading choices.' },
];

// Delete account (REQ-ACC-009; Q-048 MVP default; ADR-0004 rule 7; MVP defaults, D-31): a separate
// screen that says what is deleted, then a confirmation. Online only. The server deletes the user's
// data, files and sign-in account; then this phone deletes its database and signs out. The
// redesign's 6.4 (locked by the owner, 2026-11-03): the list's bullets became icons on a red tint.
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

  // Destructive actions are red and never filled; in the confirmation, keeping the account weighs the
  // same as deleting it. No fixed footer, so Delete is never pinned in reach.
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.title}>
        Delete your <Text style={styles.titleAccent}>account</Text>
      </Text>
      <View style={styles.panel}>
        <Text style={styles.lead}>Deleting your account deletes, for good:</Text>
        {DELETED.map(({ icon: Icon, text }) => (
          <View key={text} style={styles.item}>
            <View style={styles.itemTile} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              <Icon size={18} color={colors.danger} />
            </View>
            <Text style={styles.itemText}>{text}</Text>
          </View>
        ))}
      </View>
      <View style={styles.warning}>
        <TriangleAlert size={20} color={colors.danger} />
        <Text style={styles.warningText}>It can't be undone. Anything on this phone that isn't on the server yet is deleted too.</Text>
      </View>
      <Message text={message} offline={message === TEXTS.needsInternet('Deleting your account')} />
      {confirming ? (
        <View accessibilityRole="alert" style={styles.confirm}>
          <Text style={styles.confirmText}>Delete your account? This can't be undone.</Text>
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
        <TextButton title="Delete my account" outlined wide destructive icon={Trash} onPress={() => setConfirming(true)} />
      )}
    </ScrollView>
  );
}

// 16 between the groups; the list's rows 12 apart.
const useStyles = themedStyles((c) => ({
  content: { padding: 16, paddingTop: 22, paddingBottom: 34, gap: 16 },
  title: { ...TYPE.sheetTitle },
  titleAccent: { color: c.danger },
  panel: { padding: 16, borderRadius: 4, backgroundColor: c.surface, gap: 12 },
  lead: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  itemTile: { width: 32, height: 32, borderRadius: 4, backgroundColor: c.dangerTint, alignItems: 'center', justifyContent: 'center' },
  itemText: { flex: 1, paddingTop: 5, fontSize: 15, lineHeight: 22 },
  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: c.danger,
    backgroundColor: c.dangerTint,
  },
  warningText: { flex: 1, fontSize: 15, lineHeight: 22, fontWeight: '600' },
  confirm: { gap: 14, padding: 16, borderWidth: 1.5, borderColor: c.danger, borderRadius: 4, backgroundColor: c.surface },
  confirmText: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  // The way out on the left, the red action on the right, the same size.
  actions: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
}));
