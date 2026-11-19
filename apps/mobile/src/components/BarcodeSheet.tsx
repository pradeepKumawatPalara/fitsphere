import {
  AI_CONSENT_TEXT,
  AI_CONSENT_TEXT_VERSION,
  barcodeSchema,
  BARCODE_ESTIMATE_NAME_MAX,
  BARCODE_ESTIMATE_NAME_MIN,
  OFF_ATTRIBUTION,
  type BarcodeEstimateResponse,
  type BarcodeProduct,
  type MealItem,
} from '@fitsphere/shared';
import { PenLine, ScanBarcode, Search, Sparkles, WifiOff } from 'lucide-react-native';
import { useState, type ComponentType } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { readAiConsent, saveAiConsent } from '../api/account';
import { estimateProduct } from '../api/barcodeEstimate';
import { lookUpBarcode } from '../api/barcodes';
import { useAuth } from '../auth/AuthProvider';
import { TEXTS } from '../auth/texts';
import { GRAMS_RULE, hasKcalAndProtein, itemFromBarcode, parseGrams, productName } from '../mealItems';
import { useFieldChecks } from '../fieldChecks';
import { useLocalDatabase } from '../local/LocalDatabaseProvider';
import { searchFoods, setMeta } from '../local/store';
import { formatGrams, formatKcal } from '../meals';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { BarcodeCamera, type ScannerProps } from './BarcodeCamera';
import { GramsBox } from './GramsBox';
import { type EstimateSource } from './OwnFoodSheet';
import { Sheet } from './Sheet';
import { Banner, Field, Problem, Text, TextButton, TextInput, useFieldInputStyle } from './ui';

type Step =
  | { kind: 'scan' }
  | { kind: 'looking' }
  | { kind: 'found'; barcode: string; product: BarcodeProduct }
  /** D-117: the barcode is found nowhere; the name box opens at once and the user names the product. */
  | { kind: 'naming' }
  | { kind: 'listed'; name: string; count: number }
  | { kind: 'consent'; name: string }
  | { kind: 'estimating' }
  | { kind: 'aiOff' }
  | { kind: 'offline' }
  | { kind: 'unavailable' };

/** The values an AI estimate hands to "Enter your own food", per 100 g. */
export type ProductEstimateValues = Pick<BarcodeEstimateResponse, 'kcal' | 'proteinG' | 'carbsG' | 'fatG' | 'fibreG'>;

// Scan a barcode (REQ-LOG-007; ADR-0006 rule 2): the camera or the typed digits, looked up through
// the FitSphere API, which asks Open Food Facts with the barcode only. Needs the internet; when
// there is none, or the product is not known or lacks kcal or protein, "Enter your own food" is
// offered instead (MVP defaults, D-26). Open Food Facts is credited wherever its values are shown.
export function BarcodeSheet({
  onAdd,
  onOwnFood,
  onSearchList,
  onClose,
  Scanner = BarcodeCamera,
}: {
  onAdd(item: MealItem): void;
  /** Opens "Enter your own food", with the product's name when there is one, and an AI estimate's values (D-117). */
  onOwnFood(name: string, estimate?: ProductEstimateValues, source?: EstimateSource): void;
  /** Opens Search foods on the name the user typed for a barcode found nowhere (D-117). */
  onSearchList(name: string): void;
  onClose(): void;
  Scanner?: ComponentType<ScannerProps>;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const fieldInput = useFieldInputStyle();
  const { deps } = useAuth();
  const local = useLocalDatabase();
  const [step, setStep] = useState<Step>({ kind: 'scan' });
  const [barcodeSeen, setBarcodeSeen] = useState('');
  const [nameText, setNameText] = useState('');
  const [typed, setTyped] = useState('');
  const [typing, setTyping] = useState(false);
  const [gramsText, setGramsText] = useState('100');

  async function lookUp(barcode: string) {
    setBarcodeSeen(barcode);
    setStep({ kind: 'looking' });
    const outcome = await lookUpBarcode(deps, barcode);
    if (outcome.kind === 'found') {
      setGramsText('100');
      setStep({ kind: 'found', barcode, product: outcome.product });
    } else {
      setStep({ kind: outcome.kind === 'notFound' ? 'naming' : outcome.kind });
    }
  }

  const productNameText = nameText.trim();
  const nameValid = productNameText.length >= BARCODE_ESTIMATE_NAME_MIN && productNameText.length <= BARCODE_ESTIMATE_NAME_MAX;

  // The user's other choice (D-117): our own list (the phone's, no AI); no match goes on to an estimate.
  async function searchList() {
    if (!nameValid) return;
    const db = local.state.status === 'ready' ? local.state.db : null;
    const matches = db ? await searchFoods(db, productNameText, 5) : [];
    if (matches.length > 0) setStep({ kind: 'listed', name: productNameText, count: matches.length });
    else await estimate(productNameText);
  }

  /** Consent first: asked once, when never chosen or chosen on an older text (REQ-ACC-004, invariant #3). */
  async function estimate(name: string) {
    setStep({ kind: 'estimating' });
    const consent = await readAiConsent(deps);
    if (consent.kind === 'offline') return setStep({ kind: 'offline' });
    if (consent.kind !== 'ok') return setStep({ kind: 'unavailable' });
    const db = local.state.status === 'ready' ? local.state.db : null;
    if (db) await setMeta(db, 'ai_consent', JSON.stringify(consent.consent));
    if (consent.consent === null || consent.consent.textVersion !== AI_CONSENT_TEXT_VERSION) return setStep({ kind: 'consent', name });
    if (!consent.consent.consented) return setStep({ kind: 'aiOff' });
    await runEstimate(name);
  }

  async function answerConsent(name: string, consented: boolean) {
    if (!consented) return setStep({ kind: 'aiOff' });
    setStep({ kind: 'estimating' });
    const saved = await saveAiConsent(deps, true);
    const db = local.state.status === 'ready' ? local.state.db : null;
    if (saved.kind === 'ok' && db) await setMeta(db, 'ai_consent', JSON.stringify(saved.consent));
    if (saved.kind !== 'ok') return setStep({ kind: saved.kind === 'offline' ? 'offline' : 'unavailable' });
    await runEstimate(name);
  }

  async function runEstimate(name: string) {
    setStep({ kind: 'estimating' });
    const result = await estimateProduct(deps, barcodeSeen, name);
    if (result.kind === 'consent') return setStep({ kind: 'consent', name });
    if (result.kind !== 'ok') return setStep({ kind: result.kind });
    const { name: tidy, brand, ...values } = result.estimate;
    onClose();
    onOwnFood((brand ? `${tidy} (${brand})` : tidy).slice(0, BARCODE_ESTIMATE_NAME_MAX), values);
  }

  const typedValid = barcodeSchema.safeParse(typed.trim()).success;
  // Each problem shows once typing pauses or the box is left (D-99).
  const checks = useFieldChecks({ digits: typed, grams: gramsText });
  const typedRefused = typed.trim() !== '' && !typedValid && checks.shows('digits');
  const grams = parseGrams(gramsText);
  const found = step.kind === 'found' ? step : null;
  const usable = found && hasKcalAndProtein(found.product) ? found.product : null;
  const preview = found && usable && grams !== null ? itemFromBarcode(found.barcode, usable, grams) : null;
  // The step to take when the barcode gives no values: outlined; scanning again is a link.
  const ownFood = (name = '') => (
    <TextButton
      title="Enter your own food"
      outlined
      wide
      icon={PenLine}
      onPress={() => {
        onClose();
        onOwnFood(name);
      }}
    />
  );
  const scanAgain = <TextButton title="Scan another barcode" icon={ScanBarcode} onPress={() => setStep({ kind: 'scan' })} />;

  return (
    <Sheet
      title={found ? productName(found.product) : 'Scan barcode'}
      onClose={onClose}
      actions={
        <>
          {step.kind === 'scan' ? (
            <TextButton title="Look up" filled disabled={!typedValid} onPress={() => void lookUp(typed.trim())} />
          ) : null}
          {step.kind === 'naming' ? (
            <TextButton title="Search with AI" filled icon={Sparkles} disabled={!nameValid} onPress={() => void estimate(productNameText)} />
          ) : null}
          {usable ? (
            <TextButton
              title="Add"
              filled
              disabled={!preview}
              onPress={() => {
                if (!preview) return;
                onAdd(preview);
                onClose();
              }}
            />
          ) : null}
          <TextButton title="Close" wide onPress={onClose} />
        </>
      }
    >
      {step.kind === 'scan' ? (
        <>
          <Scanner onScanned={(barcode) => void lookUp(barcode)} />
          <Text style={styles.muted}>Or type the digits under the barcode:</Text>
          <TextInput
            accessibilityLabel="Barcode digits"
            value={typed}
            onChangeText={setTyped}
            onFocus={() => {
              setTyping(true);
              checks.focus('digits');
            }}
            onBlur={() => {
              setTyping(false);
              checks.blur('digits');
            }}
            keyboardType="number-pad"
            maxLength={14}
            style={[fieldInput, styles.number, typing && styles.typing, typedRefused && styles.refused]}
          />
          {typedRefused ? <Problem text="Enter the 8 to 14 digits under the barcode." /> : null}
        </>
      ) : null}

      {step.kind === 'looking' ? (
        <View style={styles.looking}>
          <ActivityIndicator color={colors.accent} />
          <Text accessibilityRole="progressbar" style={styles.muted}>
            Looking up the barcode…
          </Text>
        </View>
      ) : null}

      {found ? (
        <>
          {usable ? (
            <>
              <Text style={styles.muted}>
                Per 100 g: {formatKcal(usable.kcal)} · {formatGrams(usable.proteinG)} protein
              </Text>
              <GramsBox
                value={gramsText}
                onChangeText={setGramsText}
                refused={!preview && checks.shows('grams')}
                onFocus={() => checks.focus('grams')}
                onBlur={() => checks.blur('grams')}
              />
              {preview ? (
                <Text accessibilityLabel={`Adds ${formatKcal(preview.kcal)} and ${formatGrams(preview.proteinG)} protein`} style={styles.preview}>
                  = {formatKcal(preview.kcal)} · {formatGrams(preview.proteinG)} protein
                </Text>
              ) : checks.shows('grams') ? (
                <Problem text={GRAMS_RULE} />
              ) : null}
            </>
          ) : (
            <>
              <Text accessibilityRole="alert" style={styles.body}>
                Open Food Facts doesn’t have this product’s kcal and protein. Enter them from the label.
              </Text>
              {ownFood(productName(found.product))}
            </>
          )}
          <Text style={styles.attribution}>{OFF_ATTRIBUTION}.</Text>
          {scanAgain}
        </>
      ) : null}

      {step.kind === 'naming' ? (
        <>
          <Text accessibilityRole="alert" style={styles.body}>
            This product isn’t in Open Food Facts yet. Type its name and AI will estimate the values.
          </Text>
          <Field label="Product name" value={nameText} onChangeText={setNameText} autoCapitalize="words" maxLength={BARCODE_ESTIMATE_NAME_MAX} />
          <Text style={styles.attribution}>Barcode {barcodeSeen}. Add the brand if you know it.</Text>
          <TextButton title="Search our food list" outlined wide icon={Search} disabled={!nameValid} onPress={() => void searchList()} />
          {ownFood(productNameText)}
          {scanAgain}
        </>
      ) : null}

      {step.kind === 'listed' ? (
        <>
          <Banner tone="success" text={`${step.count === 5 ? '5 or more foods' : step.count === 1 ? '1 food' : `${step.count} foods`} in our list match “${step.name}”.`} />
          <TextButton
            title="Show the matches"
            filled
            wide
            icon={Search}
            onPress={() => {
              onClose();
              onSearchList(step.name);
            }}
          />
          <TextButton title="None of these: get an estimate" outlined wide icon={Sparkles} onPress={() => void estimate(step.name)} />
        </>
      ) : null}

      {step.kind === 'consent' ? (
        <>
          <Text style={styles.body}>{AI_CONSENT_TEXT}</Text>
          <Text style={styles.muted}>You can change this at any time in Settings › AI meal reading.</Text>
          <TextButton title="Agree and estimate" filled wide icon={Sparkles} onPress={() => void answerConsent(step.name, true)} />
          <TextButton title="Not now" wide onPress={() => void answerConsent(step.name, false)} />
        </>
      ) : null}

      {step.kind === 'estimating' ? (
        <View style={styles.looking}>
          <ActivityIndicator color={colors.accent} />
          <Text accessibilityRole="progressbar" style={styles.muted}>
            Estimating the values…
          </Text>
        </View>
      ) : null}

      {step.kind === 'aiOff' ? (
        <>
          <Banner tone="info" text="AI is off, so there is no estimate. Turn it on in Settings › AI meal reading, or enter the values yourself." />
          {ownFood(productNameText)}
          {scanAgain}
        </>
      ) : null}

      {step.kind === 'offline' ? (
        <>
          <Banner tone="error" icon={WifiOff} text={TEXTS.needsInternet('Looking up a barcode')} />
          {ownFood()}
          {scanAgain}
        </>
      ) : null}

      {step.kind === 'unavailable' ? (
        <>
          <Banner tone="error" text="Barcode lookup isn’t available right now. Try again later, or enter your own food." />
          {ownFood()}
          {scanAgain}
        </>
      ) : null}
    </Sheet>
  );
}

// The redesign's 3.7 (locked by the owner, 2026-11-03), as Search foods (3.6): the product's name as
// the sheet's title, the grams large in their box, what an addition comes to in condensed figures;
// no connection or no lookup as an error banner; "Enter your own food" outlined across the sheet.
const useStyles = themedStyles((c) => ({
  number: { letterSpacing: 1, fontVariant: ['tabular-nums'] },
  typing: { borderColor: c.accent },
  refused: { borderColor: c.danger },
  looking: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderRadius: 4,
    backgroundColor: c.surfaceSunken,
  },
  body: { fontSize: 16, lineHeight: 24 },
  muted: { fontSize: 15, lineHeight: 22, color: c.inkMuted },
  preview: { ...TYPE.metric },
  attribution: { color: c.inkMuted, fontSize: 12, lineHeight: 16 },
}));
