import { CameraView, useCameraPermissions, type BarcodeType } from 'expo-camera';
import { Camera, CameraOff } from 'lucide-react-native';
import { useRef } from 'react';
import { View } from 'react-native';
import { themedStyles, useTheme } from '../theme';
import { Text, TextButton } from './ui';

/** The packaged-food barcodes FitSphere reads (ADR-0006 rule 2). */
const BARCODE_TYPES: BarcodeType[] = ['ean13', 'ean8', 'upc_a', 'upc_e'];

export type ScannerProps = { onScanned(barcode: string): void };

// The camera, used only to read a barcode: no photo is taken or kept. Asks for the camera when
// first used; without it, the barcode can still be typed (BarcodeSheet).
export function BarcodeCamera({ onScanned }: ScannerProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const done = useRef(false);

  if (!permission) return null;
  if (!permission.granted) {
    const Icon = permission.canAskAgain ? Camera : CameraOff;
    return (
      <View style={styles.ask}>
        <View style={styles.tile}>
          <Icon size={24} color={colors.accent} />
        </View>
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
    <View style={styles.panel}>
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
      {/* Where to hold the barcode: caramel corners and a line across, over the picture. */}
      <View pointerEvents="none" style={styles.overlay}>
        <View style={styles.frame}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
          <View style={styles.line} />
        </View>
      </View>
    </View>
  );
}

// The redesign's 3.7 (locked by the owner, 2026-11-03): the camera as a square-cornered panel with
// the frame drawn over it; without the camera, a raised card with its icon tile.
const useStyles = themedStyles((c) => ({
  ask: {
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceRaised,
  },
  tile: { width: 48, height: 48, borderRadius: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accentTint },
  body: { fontSize: 15, lineHeight: 22 },
  panel: { height: 240, borderRadius: 4, overflow: 'hidden' },
  camera: { flex: 1 },
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  frame: { width: 240, height: 120 },
  corner: { position: 'absolute', width: 26, height: 26, borderColor: c.primary },
  topLeft: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  topRight: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  line: { position: 'absolute', top: 59, left: 14, right: 14, height: 2, opacity: 0.8, backgroundColor: c.primary },
}));
