import { fireEvent, render, screen } from '@testing-library/react-native';
import { BarcodeCamera } from './BarcodeCamera';

type Permission = { granted: boolean; canAskAgain: boolean } | null;
let mockPermission: Permission = null;
const mockRequest = jest.fn();
const mockCameraProps: { barcodeScannerSettings?: unknown; onBarcodeScanned?(result: { data: string }): void }[] = [];

jest.mock('expo-camera', () => ({
  useCameraPermissions: () => [mockPermission, mockRequest],
  CameraView: (props: (typeof mockCameraProps)[number]) => {
    mockCameraProps.push(props);
    return null;
  },
}));

// The barcode camera (ADR-0006 rule 2; REQ-LOG-007): asks for the camera when first used, reads
// packaged-food barcodes only, and reports one barcode per scan.

beforeEach(() => {
  mockCameraProps.length = 0;
  mockRequest.mockClear();
});

it('asks for the camera, and says how to go on when it is off', async () => {
  mockPermission = { granted: false, canAskAgain: true };
  const { rerender } = await render(<BarcodeCamera onScanned={jest.fn()} />);

  await fireEvent.press(screen.getByRole('button', { name: 'Allow camera' }));
  expect(mockRequest).toHaveBeenCalledTimes(1);

  mockPermission = { granted: false, canAskAgain: false };
  await rerender(<BarcodeCamera onScanned={jest.fn()} />);
  expect(screen.getByText(/Camera access is off for FitSphere. You can type the barcode instead/)).toBeOnTheScreen();
  expect(mockCameraProps).toEqual([]);
});

it('reads EAN-13, EAN-8, UPC-A and UPC-E only, and reports the first barcode once', async () => {
  mockPermission = { granted: true, canAskAgain: true };
  const onScanned = jest.fn();
  await render(<BarcodeCamera onScanned={onScanned} />);

  const props = mockCameraProps.at(-1)!;
  expect(props.barcodeScannerSettings).toEqual({ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] });
  props.onBarcodeScanned!({ data: '8901234567890' });
  props.onBarcodeScanned!({ data: '8901234567890' });
  expect(onScanned.mock.calls).toEqual([['8901234567890']]);
});
