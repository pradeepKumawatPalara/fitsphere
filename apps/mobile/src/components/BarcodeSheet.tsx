import { barcodeSchema, OFF_ATTRIBUTION, type BarcodeProduct, type MealItem } from '@fitsphere/shared';
import { PenLine, ScanBarcode, WifiOff } from 'lucide-react-native';
import { useState, type ComponentType } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { lookUpBarcode } from '../api/barcodes';
import { useAuth } from '../auth/AuthProvider';
import { TEXTS } from '../auth/texts';
import { GRAMS_RULE, hasKcalAndProtein, itemFromBarcode, parseGrams, productName } from '../mealItems';
import { formatGrams, formatKcal } from '../meals';
import { themedStyles, useTheme } from '../theme';
import { TYPE } from '../typography';
import { BarcodeCamera, type ScannerProps } from './BarcodeCamera';
import { GramsBox } from './GramsBox';
import { Sheet } from './Sheet';
import { Banner, Problem, Text, TextButton, TextInput, useFieldInputStyle } from './ui';

type Step =
  | { kind: 'scan' }
  | { kind: 'looking' }
  | { kind: 'found'; barcode: string; product: BarcodeProduct }
  | { kind: 'notFound' }
  | { kind: 'offline' }
  | { kind: 'unavailable' };

// Scan a barcode (REQ-LOG-007; ADR-0006 rule 2): the camera or the typed digits, looked up through
// the FitSphere API, which asks Open Food Facts with the barcode only. Needs the internet; when
// there is none, or the product is not known or lacks kcal or protein, "Enter your own food" is
// offered instead (MVP defaults, D-26). Open Food Facts is credited wherever its values are shown.
export function BarcodeSheet({
  onAdd,
  onOwnFood,
  onClose,
  Scanner = BarcodeCamera,
}: {
  onAdd(item: MealItem): void;
  /** Opens "Enter your own food", with the product's name when there is one. */
  onOwnFood(name: string): void;
  onClose(): void;
  Scanner?: ComponentType<ScannerProps>;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const fieldInput = useFieldInputStyle();
  const { deps } = useAuth();
  const [step, setStep] = useState<Step>({ kind: 'scan' });
  const [typed, setTyped] = useState('');
  const [typing, setTyping] = useState(false);
  const [gramsText, setGramsText] = useState('100');

  async function lookUp(barcode: string) {
    setStep({ kind: 'looking' });
    const outcome = await lookUpBarcode(deps, barcode);
    if (outcome.kind === 'found') {
      setGramsText('100');
      setStep({ kind: 'found', barcode, product: outcome.product });
    } else {
      setStep({ kind: outcome.kind });
    }
  }

  const typedValid = barcodeSchema.safeParse(typed.trim()).success;
  const typedRefused = typed.trim() !== '' && !typedValid;
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
            onFocus={() => setTyping(true)}
            onBlur={() => setTyping(false)}
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
              <GramsBox value={gramsText} onChangeText={setGramsText} refused={!preview} />
              {preview ? (
                <Text accessibilityLabel={`Adds ${formatKcal(preview.kcal)} and ${formatGrams(preview.proteinG)} protein`} style={styles.preview}>
                  = {formatKcal(preview.kcal)} · {formatGrams(preview.proteinG)} protein
                </Text>
              ) : (
                <Problem text={GRAMS_RULE} />
              )}
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

      {step.kind === 'notFound' ? (
        <>
          <Text accessibilityRole="alert" style={styles.body}>
            This product isn’t in Open Food Facts yet. Enter the values from the label.
          </Text>
          {ownFood()}
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
