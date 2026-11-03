import {
  addDays,
  istToday,
  MAX_LIST_LIMIT,
  syncWindowStart,
  type MeResponse,
  type WeighInsPage,
} from '@fitsphere/shared';
import { ClockArrowDown, WifiOff } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { callApi } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { TEXTS } from '../auth/texts';
import { WeighInList, type HistoryRow } from '../components/WeighInList';
import { Banner, TextButton } from '../components/ui';
import { formatDay } from '../format';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { listWeighIns } from '../local/store';
import { useSync } from '../sync/SyncProvider';

const CHUNK_DAYS = 90;

// Weight history (REQ-PRG-001; ADR-0007 rule 1): the last 90 IST days from the phone, and older
// days read from the server online, 90 days at a time. Older days are shown, not stored.
export function HistoryScreen({ now = () => new Date() }: { now?: () => Date }) {
  const { deps } = useAuth();
  const local = useLocalDatabase();
  const { version } = useSync();
  const today = istToday(now());
  const windowStart = syncWindowStart(today);
  const [recent, setRecent] = useState<HistoryRow[]>([]);
  const [older, setOlder] = useState<HistoryRow[]>([]);
  const [oldestLoaded, setOldestLoaded] = useState(windowStart);
  const [message, setMessage] = useState<{ text: string; tone: 'info' | 'error'; offline?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (local.state.status !== 'ready') return;
    let active = true;
    void listWeighIns(local.state.db, windowStart, today).then((entries) => {
      if (!active) return;
      setRecent(
        entries.map((entry) => ({
          day: entry.day,
          weightGrams: entry.weightGrams,
          ...(entry.syncState === 'pending' ? { note: 'waiting to sync' } : {}),
          ...(entry.syncState === 'rejected' ? { note: 'not saved' } : {}),
        })),
      );
    });
    return () => {
      active = false;
    };
  }, [local.state, windowStart, today, version]);

  async function loadOlder() {
    setBusy(true);
    setMessage(null);
    const to = addDays(oldestLoaded, -1);
    const from = addDays(to, -(CHUNK_DAYS - 1));
    const result = await fetchOlder(from, to);
    setBusy(false);
    if (result === 'offline') {
      setMessage({ text: TEXTS.needsInternet('Loading older history'), tone: 'error', offline: true });
      return;
    }
    if (result === 'failed') {
      setMessage({ text: TEXTS.tryLater, tone: 'error' });
      return;
    }
    setOlder((rows) => [...rows, ...result]);
    setOldestLoaded(from);
    // The days as everywhere else, e.g. "Fri 8 May" (the redesign's 5.2; they were shown as 2026-05-08).
    if (result.length === 0) setMessage({ text: `No weights from ${formatDay(from)} to ${formatDay(to)}.`, tone: 'info' });
  }

  async function fetchOlder(from: string, to: string): Promise<HistoryRow[] | 'offline' | 'failed'> {
    const session = (await deps.client.getSession()).data.session;
    if (!session) return 'failed';
    const options = { token: session.access_token, ...(deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {}) };
    const me = await callApi<MeResponse>(deps.apiUrl, '/me', options);
    if (me.kind !== 'ok') return me.kind === 'offline' ? 'offline' : 'failed';
    const page = await callApi<WeighInsPage>(
      deps.apiUrl,
      `/users/${me.body.user.id}/weigh-ins?from=${from}&to=${to}&limit=${MAX_LIST_LIMIT}`,
      options,
    );
    if (page.kind !== 'ok') return page.kind === 'offline' ? 'offline' : 'failed';
    return [...page.body.items].reverse().map((item) => ({ day: item.day, weightGrams: item.weightGrams }));
  }

  return (
    <WeighInList
      rows={[...recent, ...older]}
      footer={
        <View style={styles.footer}>
          {message ? <Banner tone={message.tone} text={message.text} {...(message.offline ? { icon: WifiOff } : {})} /> : null}
          <TextButton title="Load older" outlined wide icon={ClockArrowDown} disabled={busy} onPress={() => void loadOlder()} />
        </View>
      }
    />
  );
}

// The redesign's 5.2 (locked by the owner, 2026-11-03): as Training's Load older (4.1), across the
// screen under the list, its message as a banner.
const styles = StyleSheet.create({
  footer: { paddingTop: 16, gap: 12 },
});
