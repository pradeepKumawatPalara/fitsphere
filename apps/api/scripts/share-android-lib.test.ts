import { describe, expect, it } from 'vitest';
import { nextShareVersion, readBuildNumber, withAppVersion } from './share-android-lib.ts';

describe('share:android: the next version', () => {
  it("keeps app.json's major and minor and ends with the build number this build takes", () => {
    expect(nextShareVersion('1.0.0', 1)).toBe('1.0.2');
    expect(nextShareVersion('1.2.7', 41)).toBe('1.2.42');
  });

  it('reads a version of two parts', () => {
    expect(nextShareVersion('2.1', 9)).toBe('2.1.10');
  });

  it('refuses a version not like 1.0.0', () => {
    expect(() => nextShareVersion('1.0.0-beta', 1)).toThrow(/not like 1\.0\.0/);
    expect(() => nextShareVersion('one', 1)).toThrow(/not like 1\.0\.0/);
  });

  it('refuses a build number that is not whole', () => {
    expect(() => nextShareVersion('1.0.0', -1)).toThrow(/not a whole number/);
    expect(() => nextShareVersion('1.0.0', 1.5)).toThrow(/not a whole number/);
  });
});

describe("share:android: EAS's last build number", () => {
  it('reads it from eas build:version:get --json', () => {
    expect(readBuildNumber('{\n  "versionCode": "1"\n}\n')).toBe(1);
  });

  it('skips text printed around the JSON', () => {
    expect(readBuildNumber('★ eas-cli@27.10.0 is now available.\n{ "versionCode": "12" }\n')).toBe(12);
  });

  it('is null when the output holds no number', () => {
    expect(readBuildNumber('')).toBeNull();
    expect(readBuildNumber('{}')).toBeNull();
    expect(readBuildNumber('{ "versionCode": "two" }')).toBeNull();
    expect(readBuildNumber('Error: not signed in {')).toBeNull();
  });
});

describe('share:android: app.json', () => {
  const appJson = [
    '{',
    '  "expo": {',
    '    "name": "FitSphere",',
    '    "version": "1.0.0",',
    '    "plugins": [["expo-sample", { "version": "9.9.9" }]]',
    '  }',
    '}',
    '',
  ].join('\r\n');

  it('sets the version and keeps every other character, CRLF too', () => {
    const updated = withAppVersion(appJson, '1.0.2');
    expect(updated).toBe(appJson.replace('"version": "1.0.0"', '"version": "1.0.2"'));
    expect((JSON.parse(updated) as { expo: { version: string } }).expo.version).toBe('1.0.2');
  });

  it('refuses rather than change another version', () => {
    const nestedFirst = '{ "expo": { "ios": { "version": "3" }, "version": "1.0.0" } }';
    expect(() => withAppVersion(nestedFirst, '1.0.2')).toThrow(/without changing something else/);
  });

  it('refuses app.json without a version', () => {
    expect(() => withAppVersion('{ "expo": { "name": "FitSphere" } }', '1.0.2')).toThrow(/no expo\.version/);
  });
});
