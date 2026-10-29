// Photo files are kept and shown as base64 JPEG text (data URIs) and sent as bytes.

/** The JPEG's bytes, from its base64 text. */
export function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const text = atob(base64);
  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index += 1) bytes[index] = text.charCodeAt(index);
  return bytes;
}

/** Base64 text for the bytes, built in chunks so a large photo does not overflow the call stack. */
export function bytesToBase64(bytes: Uint8Array): string {
  let text = '';
  for (let start = 0; start < bytes.length; start += 0x8000) {
    text += String.fromCharCode(...bytes.subarray(start, start + 0x8000));
  }
  return btoa(text);
}

/** How many bytes base64 text decodes to. */
export function base64Size(base64: string): number {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return (base64.length * 3) / 4 - padding;
}

export function jpegDataUri(base64: string): string {
  return `data:image/jpeg;base64,${base64}`;
}
