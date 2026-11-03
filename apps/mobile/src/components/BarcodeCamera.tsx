import { CameraView, useCameraPermissions, type BarcodeType } from 'expo-camera';
import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, TextButton } from './ui';

/** The packaged-food barcodes FitSphere reads (ADR-0006 rule 2). */
const BARCODE_TYPES: BarcodeType[] = ['ean13', 'ean8', 'upc_a', 'upc_e'];

export type ScannerProps = { onScanned(barcode: string): void };

// The camera, used only to read a barcode: no photo is taken or kept. Asks for the camera when
// first used; without it, the barcode can still be typed (BarcodeSheet).
export function BarcodeCamera({ onScanned }: ScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const done = useRef(false);

  if (!permission) return null;
  if (!permission.granted) {
    return (
      <View style={styles.ask}>
        {permission.canAskAgain ? (
          <>
            <Text style={styles.body}>FitSphere needs the camera to scan a barcode.</Text>
            <TextButton title="Allow camera" outlined onPress={() => void requestPermission()} />
          </>
        ) : (
          <Text style={styles.body}>Camera access is off for FitSphere. You can type the barcode instead, or allow the camera in Android settings.</Text>
        )}
      </View>
    );
  }
  return (
    <CameraView
      style={styles.camera}
      facing="back"
      barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
      onBarcodeScanned={(result) => {
        // The camera reports the same barcode many times a second; the first one is enough.
        if (done.current) return;
        done.current = true;
        onScanned(result.data);
      }}
    />
  );
}

// The camera is a panel: radius 12, as tiles and panels elsewhere.
const styles = StyleSheet.create({
  ask: { gap: 12, paddingVertical: 8 },
  body: { fontSize: 15 },
  camera: { height: 240, borderRadius: 12, overflow: 'hidden' },
});
