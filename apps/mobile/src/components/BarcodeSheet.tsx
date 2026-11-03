import { barcodeSchema, OFF_ATTRIBUTION, type BarcodeProduct, type MealItem } from '@fitsphere/shared';
import { useState, type ComponentType } from 'react';
import { View } from 'react-native';
import { lookUpBarcode } from '../api/barcodes';
import { useAuth } from '../auth/AuthProvider';
import { TEXTS } from '../auth/texts';
import { GRAMS_RULE, hasKcalAndProtein, itemFromBarcode, parseGrams, productName } from '../mealItems';
import { formatGrams, formatKcal } from '../meals';
import { themedStyles } from '../theme';
import { BarcodeCamera, type ScannerProps } from './BarcodeCamera';
import { Sheet } from './Sheet';
import { Text, TextButton, TextInput, useFieldInputStyle } from './ui';

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
  const fieldInput = useFieldInputStyle();
  const { deps } = useAuth();
  const [step, setStep] = useState<Step>({ kind: 'scan' });
  const [typed, setTyped] = useState('');
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
  const grams = parseGrams(gramsText);
  const found = step.kind === 'found' ? step : null;
  const usable = found && hasKcalAndProtein(found.product) ? found.product : null;
  const preview = found && usable && grams !== null ? itemFromBarcode(found.barcode, usable, grams) : null;
  // The step to take when the barcode gives no values: outlined; scanning again is a link.
  const ownFood = (name = '') => (
    <TextButton
      title="Enter your own food"
      outlined
      onPress={() => {
        onClose();
        onOwnFood(name);
      }}
    />
  );
  const scanAgain = <TextButton title="Scan another barcode" onPress={() => setStep({ kind: 'scan' })} />;

  return (
    <Sheet
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
          <Text accessibilityRole="header" style={styles.title}>
            Scan barcode
          </Text>
          <Scanner onScanned={(barcode) => void lookUp(barcode)} />
          <Text style={styles.body}>Or type the digits under the barcode:</Text>
          <TextInput
            accessibilityLabel="Barcode digits"
            value={typed}
            onChangeText={setTyped}
            keyboardType="number-pad"
            maxLength={14}
            style={[fieldInput, styles.number]}
          />
          {typed.trim() !== '' && !typedValid ? <Text style={styles.problem}>Enter the 8 to 14 digits under the barcode.</Text> : null}
        </>
      ) : null}

      {step.kind === 'looking' ? (
        <Text accessibilityRole="progressbar" style={styles.muted}>
          Looking up the barcode…
        </Text>
      ) : null}

      {found ? (
        <>
          <Text accessibilityRole="header" style={styles.title}>
            {productName(found.product)}
          </Text>
          {usable ? (
            <>
              <Text style={styles.body}>
                Per 100 g: {formatKcal(usable.kcal)} · {formatGrams(usable.proteinG)} protein
              </Text>
              <View style={styles.inputRow}>
                <TextInput
                  accessibilityLabel="Grams eaten"
                  value={gramsText}
                  onChangeText={setGramsText}
                  keyboardType="number-pad"
                  style={[fieldInput, styles.grow, styles.number]}
                />
                <Text style={styles.unit}>g</Text>
              </View>
              {preview ? (
                <Text accessibilityLabel={`Adds ${formatKcal(preview.kcal)} and ${formatGrams(preview.proteinG)} protein`} style={styles.preview}>
                  = {formatKcal(preview.kcal)} · {formatGrams(preview.proteinG)} protein
                </Text>
              ) : (
                <Text accessibilityRole="alert" style={styles.problem}>
                  {GRAMS_RULE}
                </Text>
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
          <Text accessibilityRole="alert" style={styles.body}>
            {TEXTS.needsInternet('Looking up a barcode')}
          </Text>
          {ownFood()}
          {scanAgain}
        </>
      ) : null}

      {step.kind === 'unavailable' ? (
        <>
          <Text accessibilityRole="alert" style={styles.body}>
            Barcode lookup isn’t available right now. Try again later, or enter your own food.
          </Text>
          {ownFood()}
          {scanAgain}
        </>
      ) : null}
    </Sheet>
  );
}

// As Search foods: the title as the sheets' titles, what an addition comes to at the size of a value.
const useStyles = themedStyles((c) => ({
  title: { fontSize: 20, fontWeight: '600' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  grow: { flex: 1 },
  number: { fontVariant: ['tabular-nums'] },
  unit: { fontSize: 15, color: c.textMuted },
  body: { fontSize: 15 },
  muted: { fontSize: 15, color: c.textMuted },
  preview: { fontSize: 20, fontWeight: '600', fontVariant: ['tabular-nums'] },
  attribution: { color: c.textMuted, fontSize: 13 },
  problem: { fontSize: 13, color: c.error },
}));
