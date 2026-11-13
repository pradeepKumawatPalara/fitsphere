// Where the API listens (runbook, "Configuration names"). On the PC it stays on loopback: the phone
// reaches it through the development tunnel (runbook step 8), and it stays off the local network.
// On Cloud Run it must listen on every address, on the port Cloud Run gives (D-101): the image sets
// HOST=0.0.0.0, and Cloud Run sets PORT.

export const DEFAULT_HOST = '127.0.0.1';
export const DEFAULT_PORT = 3000;

export type ListenAddress = { host: string; port: number };

/** HOST and PORT from the settings; an empty or missing one keeps the PC's default. */
export function listenAddress(env: Record<string, string | undefined>): ListenAddress {
  const host = env.HOST?.trim() || DEFAULT_HOST;
  const portText = env.PORT?.trim() || String(DEFAULT_PORT);
  const port = Number(portText);
  if (!/^\d+$/.test(portText) || port < 1 || port > 65535) {
    throw new Error(`PORT must be a whole number from 1 to 65535, not "${portText}".`);
  }
  return { host, port };
}
