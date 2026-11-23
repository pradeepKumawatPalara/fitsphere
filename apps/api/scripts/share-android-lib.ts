// Pure parts of `npm run share:android` (share-android.ts), kept apart so they can be tested
// without starting EAS.

/**
 * The version name for the next shared build: app.json's major and minor, then the build number
 * this build takes, EAS's last one plus one (eas.json: `appVersionSource` remote, `autoIncrement`).
 * So 1.0.0 with build 1 last gives 1.0.2, which Firebase App Distribution lists as 1.0.2 (2).
 */
export function nextShareVersion(appVersion: string, lastBuildNumber: number): string {
  const match = /^(\d+)\.(\d+)(?:\.\d+)?$/.exec(appVersion.trim());
  if (!match) throw new Error(`The version in apps/mobile/app.json, "${appVersion}", is not like 1.0.0.`);
  if (!Number.isSafeInteger(lastBuildNumber) || lastBuildNumber < 0) {
    throw new Error(`EAS's last build number, ${lastBuildNumber}, is not a whole number.`);
  }
  return `${match[1]}.${match[2]}.${lastBuildNumber + 1}`;
}

/**
 * EAS's last Android build number from the output of `eas build:version:get --json`
 * (`{ "versionCode": "1" }`), or null when the output holds none.
 */
export function readBuildNumber(output: string): number | null {
  const start = output.indexOf('{');
  const end = output.lastIndexOf('}');
  if (start === -1 || end < start) return null;
  let value: unknown;
  try {
    value = (JSON.parse(output.slice(start, end + 1)) as { versionCode?: unknown }).versionCode;
  } catch {
    return null;
  }
  const number = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  return typeof number === 'number' && Number.isSafeInteger(number) && number >= 0 ? number : null;
}

type AppJson = { expo?: { version?: unknown } };

/**
 * app.json's text with the app's version (`expo.version`) set to `version`. Every other character
 * is kept, CRLF line endings too. Throws rather than change anything else.
 */
export function withAppVersion(appJson: string, version: string): string {
  const updated = appJson.replace(
    /("expo"\s*:\s*\{[\s\S]*?"version"\s*:\s*")[^"]*(")/,
    (_whole, before: string, after: string) => `${before}${version}${after}`,
  );
  const expected = JSON.parse(appJson) as AppJson;
  if (expected.expo === undefined || typeof expected.expo.version !== 'string') {
    throw new Error('apps/mobile/app.json has no expo.version.');
  }
  expected.expo.version = version;
  if (JSON.stringify(JSON.parse(updated)) !== JSON.stringify(expected)) {
    throw new Error("Couldn't set the version in apps/mobile/app.json without changing something else.");
  }
  return updated;
}
