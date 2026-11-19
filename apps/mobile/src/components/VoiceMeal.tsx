import { AI_CONSENT_TEXT, AI_CONSENT_TEXT_VERSION, type MealItem, type ParsedMealItem } from '@fitsphere/shared';
import { CameraOff, Check, CircleAlert, Mic, MicOff, Square, SquareCheck, WifiOff } from 'lucide-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { readMeal } from '../api/aiMeal';
import { readAiConsent, saveAiConsent } from '../api/account';
import { lookUpFood } from '../api/foodLookup';
import { readPhoto } from '../api/photoMeal';
import { useAuth } from '../auth/AuthProvider';
import { formatAmount, formatKcal } from '../meals';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { getMeta, setMeta } from '../local/store';
import { DEFAULT_VOICE_LANGUAGE, languageInstalled, LISTEN_MAX_MS, silenceAllowedMs, speechEngine, VOICE_LANGUAGES, type VoiceLanguage } from '../speech';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { findSpokenFoods, type FoodListSearch, type FoundFood } from '../voiceMeal';
import type { ProductEstimateValues } from './BarcodeSheet';
import { FoodDetail } from './FoodDetail';
import type { EstimateSource } from './OwnFoodSheet';
import { Sheet } from './Sheet';
import { Text, TextButton } from './ui';

// Voice meal logging in Search foods (D-115; the canvas's VoiceMealLocked, locked 2026-11-17: option C
// with option B's review). A "Speak your meal" row under the search box, only where the phone can
// recognise speech on the device (B-15). Listening replaces the results with a panel, the words also
// filling the search box; only Done, or 30 seconds, ends it (a pause doesn't); Cancel keeps the words
// as a search. The text
// (never audio) is read by AI only with consent given on the current text, asked once (REQ-ACC-004);
// the foods it names are found in the phone's food list (voiceMeal.ts) and listed, ticked, on a
// sheet, with those not found under "Not in our food list". Add puts the ticked foods in the meal.
// Every failure keeps the words in the box as an ordinary search.
// D-118: Log meal's camera icon (Take photo, Choose from gallery) hands the shrunk picture to this
// hook (`begin.photo`); it is read by AI only on the same consent, and the foods seen go through the
// same review. This step keeps nothing of the picture (the meal photo is attached by Log meal). A food not in our list has
// "Look up online": Open Food Facts by name, else an AI estimate, opened in "Check the estimate".

/** What a failure says, under the "Speak your meal" row (the canvas's VoiceMealShared). */
const NOTICES = {
  off: 'Your words are searched as typed. To have the foods found for you, turn on AI meal reading in Settings.',
  offline: "You're offline. Your words are kept: search them as typed, or tap Speak your meal again once you're online.",
  unavailable: "AI meal reading isn't available right now. Your words are kept: search them as typed, or try again later.",
  permission: "FitSphere can't use the microphone. Allow it in your phone's Settings › Apps › FitSphere › Permissions, then tap Speak your meal again.",
  nothing: 'Nothing was heard. Tap Speak your meal and say what you ate.',
  language: "This language isn't ready for speech on this phone. Choose another in Settings › Voice language.",
  photoPermission: "FitSphere can't use the camera. Allow it in your phone's Settings › Apps › FitSphere › Permissions, then tap Take a photo again.",
  photoFailed: "That picture couldn't be read. Try another.",
  photoNothing: 'Nothing was recognised as food in the picture.',
} as const;
type Notice = keyof typeof NOTICES;

type Stage =
  | { kind: 'idle'; notice: Notice | null }
  | { kind: 'listening'; words: string; seconds: number }
  | { kind: 'reading'; photo: boolean }
  | { kind: 'consent'; text: string }
  | { kind: 'review'; found: FoundFood[]; ticked: boolean[]; missing: ParsedMealItem[] };

/** The mic's language: Settings' choice, English (India) when Hindi isn't on the phone (D-115). */
export async function voiceLanguageOf(value: string | null): Promise<VoiceLanguage> {
  const chosen = VOICE_LANGUAGES.find((language) => language === value) ?? DEFAULT_VOICE_LANGUAGE;
  if (chosen === DEFAULT_VOICE_LANGUAGE) return chosen;
  return languageInstalled(await speechEngine().installedLanguages(), chosen) ? chosen : DEFAULT_VOICE_LANGUAGE;
}

function seconds(value: number): string {
  return `0:${String(Math.min(value, 59)).padStart(2, '0')}`;
}

/** How Search foods starts when opened from Log meal's box: already listening, or reading the words typed there. */
export type VoiceBegin = { listen: true } | { text: string } | { photo: string };

export function useVoiceMeal({
  begin,
  setQuery,
  search,
  onAdd,
  onOwnFood,
}: {
  /** The search box's text: the words heard go in it, so they stay as a search whatever happens. */
  setQuery(text: string): void;
  search: FoodListSearch;
  /** The foods ticked, and those of them whose amount was assumed; `stay` keeps Search foods open. */
  onAdd(items: MealItem[], assumed: MealItem[], stay: boolean): void;
  onOwnFood?(name: string, estimate?: ProductEstimateValues, source?: EstimateSource): void;
  begin?: VoiceBegin | null;
}): { active: boolean; row: ReactNode; panel: ReactNode; footer: ReactNode; sheets: ReactNode } {
  const styles = useStyles();
  const { colors } = useTheme();
  const { deps } = useAuth();
  const local = useLocalDatabase();
  const db = local.state.status === 'ready' ? local.state.db : null;
  const engine = speechEngine();
  // Speaking needs the phone's recogniser (or words typed in Log meal's box); a photo needs nothing more.
  const [canSpeak] = useState(() => engine.canListen() || (begin !== undefined && begin !== null && 'text' in begin));
  /** The picture waiting for consent, or being read: kept here, never in the screen's state or the database. */
  const pendingPhoto = useRef<string | null>(null);
  /** A food of the review being looked up online, or one that could not be found. */
  const [lookup, setLookup] = useState<{ at: number; state: 'busy' | 'failed' } | null>(null);
  const [stage, setStage] = useState<Stage>({ kind: 'idle', notice: null });
  // A food of the review whose amount is being changed on its page.
  const [changing, setChanging] = useState<number | null>(null);
  // The listening session (D-115, the owner's 2026-11-17 phone test): it runs until Done, 6 seconds
  // with no words, or 30 seconds; a shorter pause doesn't end it. The recognizer gives the words in
  // pieces, and may end on a short pause by itself: the final pieces are added up, and it is started
  // again until one of those three.
  const session = useRef({
    language: DEFAULT_VOICE_LANGUAGE as VoiceLanguage,
    startedAt: 0,
    /** When words were last heard (the start, before any). */
    heardAt: 0,
    /** The final pieces heard so far, and the piece being heard. */
    said: '',
    piece: '',
    /** Done or the 30 seconds: the next end of the recognizer reads the words. */
    finishing: false,
    /** The words were handed on (or dropped): nothing more happens in this session. */
    over: true,
  });
  // Set by Cancel: listening or reading that ends afterwards changes nothing.
  const cancelled = useRef(false);
  const stopListening = useRef<(() => void) | null>(null);
  const restart = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      stopListening.current?.();
      if (restart.current) clearTimeout(restart.current);
    },
    [],
  );

  // The time shown while listening, and the end after 6 seconds with no words or 30 seconds (D-115).
  const listening = stage.kind === 'listening';
  useEffect(() => {
    if (!listening) return;
    const tick = setInterval(() => {
      const elapsed = Date.now() - session.current.startedAt;
      const seconds = Math.floor(elapsed / 1000);
      setStage((current) => (current.kind === 'listening' && current.seconds !== seconds ? { ...current, seconds } : current));
      if (timeIsUp()) done();
    }, 250);
    return () => clearInterval(tick);
  });

  /** 6 seconds with no words, or 30 seconds in all. */
  function timeIsUp() {
    const now = Date.now();
    return now - session.current.heardAt >= silenceAllowedMs() || now - session.current.startedAt >= LISTEN_MAX_MS;
  }

  const joined = (...parts: string[]) => parts.map((part) => part.trim()).filter((part) => part !== '').join(' ');
  const wordsSoFar = () => joined(session.current.said, session.current.piece);

  function showWords() {
    const text = wordsSoFar();
    setQuery(text);
    setStage((current) => (current.kind === 'listening' ? { ...current, words: text } : current));
  }

  async function start() {
    if (!db) return;
    cancelled.current = false;
    pendingPhoto.current = null;
    const permission = await engine.permission();
    const allowed = permission === 'granted' || (permission === 'ask' && (await engine.requestPermission()));
    if (!allowed) {
      setStage({ kind: 'idle', notice: 'permission' });
      return;
    }
    const language = await voiceLanguageOf(await getMeta(db, 'voice_language'));
    const now = Date.now();
    session.current = { language, startedAt: now, heardAt: now, said: '', piece: '', finishing: false, over: false };
    setStage({ kind: 'listening', words: '', seconds: 0 });
    listenAgain();
  }

  /** Starts (or restarts) the recognizer for this session. */
  function listenAgain() {
    restart.current = null;
    stopListening.current?.();
    stopListening.current = engine.listen(session.current.language, {
      onWords(text, final) {
        if (session.current.over) return;
        session.current.heardAt = Date.now();
        if (final) {
          session.current.said = joined(session.current.said, text);
          session.current.piece = '';
        } else {
          session.current.piece = text;
        }
        showWords();
      },
      onError(code) {
        if (cancelled.current || session.current.over || code === 'aborted') return;
        // The microphone or the language can't be used: stop, saying why.
        if (code === 'not-allowed' || code === 'language-not-supported' || code === 'service-not-allowed' || code === 'audio-capture') {
          endSession();
          setStage({ kind: 'idle', notice: code === 'not-allowed' ? 'permission' : code === 'language-not-supported' ? 'language' : 'unavailable' });
          return;
        }
        // Silence ("no-speech") or a passing failure: keep listening until Done.
        ended();
      },
      onEnd: ended,
    });
  }

  /** The recognizer stopped: read the words after Done, 6 quiet seconds or 30 seconds; otherwise listen again. */
  function ended() {
    if (cancelled.current || session.current.over) return;
    if (session.current.finishing || timeIsUp()) {
      finish();
      return;
    }
    if (!restart.current) restart.current = setTimeout(listenAgain, 300);
  }

  /** Done, or 30 seconds: stop, then read what was said. */
  function done() {
    if (session.current.over || session.current.finishing) return;
    session.current.finishing = true;
    if (restart.current) {
      // Between two pieces: nothing is listening, so nothing will end.
      finish();
      return;
    }
    engine.stop();
    // Should the recognizer not say it ended, read the words anyway.
    setTimeout(() => finish(), 1500);
  }

  function endSession() {
    session.current.over = true;
    stopListening.current?.();
    stopListening.current = null;
    if (restart.current) clearTimeout(restart.current);
    restart.current = null;
  }

  function finish() {
    if (session.current.over || cancelled.current) return;
    const text = wordsSoFar();
    endSession();
    setQuery(text);
    if (text.length < 2) setStage({ kind: 'idle', notice: 'nothing' });
    else void afterListening(text);
  }

  function cancel() {
    cancelled.current = true;
    pendingPhoto.current = null;
    if (stage.kind === 'listening') engine.abort();
    endSession();
    setStage({ kind: 'idle', notice: null });
  }

  /** Consent first: asked once, when never chosen or chosen on an older text (D-115). */
  async function afterListening(text: string) {
    pendingPhoto.current = null;
    return afterInput(text);
  }

  /** Ends on a notice: the picture, if any, is let go of. */
  function letGo(next: Stage) {
    pendingPhoto.current = null;
    setStage(next);
  }

  async function afterInput(text: string) {
    setStage({ kind: 'reading', photo: pendingPhoto.current !== null });
    const consent = await readAiConsent(deps);
    if (cancelled.current) return;
    if (consent.kind === 'offline') return letGo({ kind: 'idle', notice: 'offline' });
    if (consent.kind !== 'ok') return letGo({ kind: 'idle', notice: 'unavailable' });
    if (db) await setMeta(db, 'ai_consent', JSON.stringify(consent.consent));
    if (consent.consent === null || consent.consent.textVersion !== AI_CONSENT_TEXT_VERSION) return setStage({ kind: 'consent', text });
    if (!consent.consent.consented) return letGo({ kind: 'idle', notice: 'off' });
    await read(text);
  }

  async function answerConsent(text: string, consented: boolean) {
    setStage(consented ? { kind: 'reading', photo: pendingPhoto.current !== null } : { kind: 'idle', notice: 'off' });
    if (!consented) pendingPhoto.current = null;
    const saved = await saveAiConsent(deps, consented);
    if (saved.kind === 'ok' && db) await setMeta(db, 'ai_consent', JSON.stringify(saved.consent));
    if (!consented || cancelled.current) return;
    if (saved.kind !== 'ok') return letGo({ kind: 'idle', notice: saved.kind === 'offline' ? 'offline' : 'unavailable' });
    await read(text);
  }

  async function read(text: string) {
    const photo = pendingPhoto.current;
    setStage({ kind: 'reading', photo: photo !== null });
    const reading = photo !== null ? await readPhoto(deps, photo) : await readMeal(deps, text);
    if (cancelled.current) return;
    if (reading.kind === 'consent') return setStage({ kind: 'consent', text });
    // Whatever the answer, the picture is let go of; only a consent step keeps it, to ask once.
    pendingPhoto.current = null;
    if (reading.kind !== 'ok') return setStage({ kind: 'idle', notice: reading.kind });
    if (!db) return setStage({ kind: 'idle', notice: 'unavailable' });
    if (photo !== null && reading.items.length === 0) return setStage({ kind: 'idle', notice: 'photoNothing' });
    const { found, missing } = await findSpokenFoods(db, reading.items, search);
    if (cancelled.current) return;
    setStage({ kind: 'review', found, ticked: found.map((food) => !food.several), missing });
  }

  function tickedOf(review: Extract<Stage, { kind: 'review' }>) {
    return review.found.filter((_, index) => review.ticked[index]);
  }

  /** "Look up online" (D-118): Open Food Facts by name, else an AI estimate; the result opens in Check the estimate. */
  async function lookUpOnline(review: Extract<Stage, { kind: 'review' }>, name: string, at: number) {
    if (!onOwnFood) return;
    setLookup({ at, state: 'busy' });
    const result = await lookUpFood(deps, name);
    if (result.kind !== 'ok') return setLookup({ at, state: 'failed' });
    setLookup(null);
    const { name: tidy, brand, source, ...values } = result.food;
    add(review, false);
    onOwnFood((brand ? `${tidy} (${brand})` : tidy).slice(0, 120), values, source);
  }

  function add(review: Extract<Stage, { kind: 'review' }>, stay: boolean) {
    const foods = tickedOf(review);
    if (foods.length > 0) onAdd(foods.map((food) => food.item), foods.filter((food) => food.assumed).map((food) => food.item), stay);
    setStage({ kind: 'idle', notice: null });
  }

  // Opened from Log meal's box (the owner, 2026-11-18): listening starts, or the words typed there are read, once.
  const began = useRef(false);
  useEffect(() => {
    if (!begin || began.current || !db) return;
    began.current = true;
    void Promise.resolve().then(() => {
      if ('listen' in begin) return start();
      if ('photo' in begin) {
        cancelled.current = false;
        pendingPhoto.current = begin.photo;
        return afterInput('');
      }
      setQuery(begin.text);
      cancelled.current = false;
      return afterListening(begin.text);
    });
  });

  const active = stage.kind === 'listening' || stage.kind === 'reading';

  const row =
    stage.kind === 'idle' ? (
      <View style={styles.rowArea}>
        {canSpeak ? <TextButton title="Speak your meal" icon={Mic} outlined wide onPress={() => void start()} /> : null}
        {stage.notice === 'off' ? (
          <View style={styles.off}>
            <Text style={styles.overline}>AI meal reading is off</Text>
            <Text style={styles.small}>{NOTICES.off}</Text>
          </View>
        ) : stage.notice ? (
          <View accessibilityRole="alert" style={styles.notice}>
            {stage.notice === 'offline' ? (
              <WifiOff size={20} color={colors.warning} />
            ) : stage.notice === 'permission' ? (
              <MicOff size={20} color={colors.warning} />
            ) : stage.notice === 'photoPermission' ? (
              <CameraOff size={20} color={colors.warning} />
            ) : (
              <CircleAlert size={20} color={colors.warning} />
            )}
            <View style={styles.noticeWords}>
              <Text style={styles.small}>{NOTICES[stage.notice]}</Text>
              {stage.notice === 'permission' || stage.notice === 'photoPermission' ? <TextButton title="Open phone settings" onPress={() => void Linking.openSettings()} /> : null}
            </View>
          </View>
        ) : null}
      </View>
    ) : null;

  const panel =
    stage.kind === 'listening' ? (
      <View style={[styles.panel, styles.panelLive]}>
        <View style={styles.ring}>
          <Mic size={32} color={colors.accent} />
        </View>
        <Text style={[styles.overline, styles.center, { color: colors.accent }]}>Listening · {seconds(stage.seconds)}</Text>
        <Text accessibilityLiveRegion="polite" style={styles.heard}>
          {stage.words}
        </Text>
        <Text style={styles.small}>Say what you ate and how much, then tap Done speaking. It also stops after 6 seconds of quiet, or at 0:30.</Text>
      </View>
    ) : stage.kind === 'reading' ? (
      <View style={styles.panel}>
        <Text accessibilityLiveRegion="polite" style={[styles.overline, styles.center]}>
          {stage.photo ? 'Finding the foods in your picture…' : 'Finding the foods you said…'}
        </Text>
        <View style={[styles.skeleton, { width: '70%' }]} />
        <View style={[styles.skeleton, { width: '50%' }]} />
        <View style={[styles.skeleton, { width: '60%' }]} />
      </View>
    ) : null;

  const footer =
    stage.kind === 'listening' ? (
      <View style={styles.footer}>
        {/* The canvas's VoiceMealDone, C locked (2026-11-17): "Done speaking" with a tick. */}
        <TextButton title="Done speaking" icon={Check} filled wide onPress={done} />
        <TextButton title="Cancel" wide onPress={cancel} />
      </View>
    ) : stage.kind === 'reading' ? (
      <View style={styles.footer}>
        <TextButton title="Cancel" wide onPress={cancel} />
      </View>
    ) : null;

  const review = stage.kind === 'review' ? stage : null;
  const tickedFoods = review ? tickedOf(review) : [];
  const tickedKcal = tickedFoods.reduce((sum, food) => sum + food.item.kcal, 0);
  const changingFood = review && changing !== null ? review.found[changing] : undefined;

  const sheets = (
    <>
      {stage.kind === 'consent' ? (
        <Sheet
          title={pendingPhoto.current !== null ? 'Read your photo with AI?' : 'Read your meal with AI?'}
          onClose={() => void answerConsent(stage.text, false)}
          actions={
            <>
              <TextButton title="Turn on" filled wide onPress={() => void answerConsent(stage.text, true)} />
              <TextButton title="Not now" wide onPress={() => void answerConsent(stage.text, false)} />
            </>
          }
        >
          <Text style={styles.body}>{AI_CONSENT_TEXT}</Text>
          <Text style={styles.small}>You can change this at any time in Settings › AI meal reading.</Text>
        </Sheet>
      ) : null}
      {review && !changingFood ? (
        <Sheet
          title={review.found.length === 0 ? 'No foods found' : `${review.found.length} ${review.found.length === 1 ? 'food' : 'foods'} found`}
          onClose={() => setStage({ kind: 'idle', notice: null })}
          actions={
            review.found.length > 0 ? (
              <TextButton
                title={tickedFoods.length > 0 ? `Add ${tickedFoods.length} ${tickedFoods.length === 1 ? 'food' : 'foods'} · ${formatKcal(tickedKcal)}` : 'Add foods'}
                filled
                wide
                disabled={tickedFoods.length === 0}
                onPress={() => add(review, false)}
              />
            ) : (
              <TextButton title="Close" wide onPress={() => setStage({ kind: 'idle', notice: null })} />
            )
          }
        >
          {review.found.length > 0 ? (
            <View style={styles.card}>
              {review.found.map((food, index) => {
                const on = review.ticked[index] === true;
                return (
                  <View key={index} style={[styles.foodRow, index > 0 && styles.ruled]}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${food.item.name}, ${formatAmount(food.item.amount)}, ${formatKcal(food.item.kcal)}${food.assumed ? ', amount not said, check it' : ''}, change the amount`}
                      onPress={() => setChanging(index)}
                      style={styles.foodText}
                    >
                      <Text style={styles.foodName}>{food.item.name}</Text>
                      <Text style={styles.foodDetail}>
                        {formatAmount(food.item.amount)} · {formatKcal(food.item.kcal)}
                      </Text>
                      {food.assumed ? (
                        <View style={styles.tag}>
                          <CircleAlert size={13} color={colors.accent} />
                          <Text style={styles.tagText}>Amount not said · check it</Text>
                        </View>
                      ) : null}
                    </Pressable>
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityLabel={`Add ${food.item.name}`}
                      accessibilityState={{ checked: on }}
                      hitSlop={10}
                      onPress={() => setStage({ ...review, ticked: review.ticked.map((value, at) => (at === index ? !value : value)) })}
                      style={styles.tick}
                    >
                      {on ? <SquareCheck size={26} color={colors.accent} /> : <Square size={26} color={colors.inkMuted} />}
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ) : null}
          {review.missing.length > 0 ? (
            <View style={styles.missing}>
              <Text accessibilityRole="header" style={styles.foodName}>
                Not in our food list
              </Text>
              {review.missing.map((food, index) => (
                <View key={index} style={styles.missingFood}>
                  <Text style={styles.small}>{food.name}</Text>
                  <View style={styles.missingActions}>
                    <TextButton
                      title="Search"
                      outlined
                      onPress={() => {
                        // The ticked foods go in first, so nothing found is lost; Search foods stays open.
                        add(review, true);
                        setQuery(food.name);
                      }}
                    />
                    {onOwnFood ? (
                      <TextButton
                        title={lookup?.at === index && lookup.state === 'busy' ? 'Looking…' : 'Look up online'}
                        outlined
                        disabled={lookup?.state === 'busy'}
                        onPress={() => void lookUpOnline(review, food.name, index)}
                      />
                    ) : null}
                    {onOwnFood ? (
                      <TextButton
                        title="Own food"
                        outlined
                        onPress={() => {
                          add(review, false);
                          onOwnFood(food.name);
                        }}
                      />
                    ) : null}
                  </View>
                  {lookup?.at === index && lookup.state === 'failed' ? (
                    <Text accessibilityRole="alert" style={styles.small}>
                      Couldn’t find it online. Enter it yourself.
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}
        </Sheet>
      ) : null}
      {review && changingFood && changing !== null ? (
        <FoodDetail
          result={changingFood.result}
          from={changingFood.item.amount}
          fromLabel="From what you said"
          backLabel="Back to the foods found"
          addTitle="Save change"
          onBack={() => setChanging(null)}
          onAdd={(item) => {
            setStage({ ...review, found: review.found.map((food, at) => (at === changing ? { ...food, item, assumed: false } : food)) });
            setChanging(null);
          }}
        />
      ) : null}
    </>
  );

  return { active, row, panel, footer, sheets };
}

const useStyles = themedStyles((c) => ({
  rowArea: { gap: 10 },
  off: { gap: 4 },
  overline: { ...TYPE.label, color: c.inkMuted },
  center: { textAlign: 'center' },
  small: { ...TYPE.small, color: c.inkMuted },
  body: { fontSize: 16, lineHeight: 23, color: c.ink },
  notice: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 12, borderRadius: 4, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  noticeWords: { flex: 1, gap: 4, alignItems: 'flex-start' },
  panel: { marginHorizontal: 16, padding: 16, gap: 14, borderRadius: 4, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  panelLive: { borderWidth: 2, borderColor: c.accent },
  ring: { width: 72, height: 72, borderRadius: 36, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', backgroundColor: c.accentTint },
  heard: { fontSize: 20, lineHeight: 28, fontWeight: '500', color: c.ink, minHeight: 28 },
  skeleton: { height: 12, borderRadius: 2, backgroundColor: c.track },
  footer: { gap: 8 },
  card: { paddingLeft: 14, paddingRight: 6, borderRadius: 4, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceRaised },
  foodRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  ruled: { borderTopWidth: 1, borderTopColor: c.border },
  foodText: { flex: 1, gap: 2 },
  foodName: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: c.ink },
  foodDetail: { fontSize: 14, lineHeight: 20, color: c.inkMuted, fontVariant: ['tabular-nums'] },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: c.accentTint },
  tagText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.accent },
  tick: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  missing: { gap: 10, padding: 12, borderRadius: 4, borderWidth: 1, borderStyle: 'dashed', borderColor: c.border, backgroundColor: c.surfaceSunken },
  missingFood: { gap: 6 },
  missingActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
}));
