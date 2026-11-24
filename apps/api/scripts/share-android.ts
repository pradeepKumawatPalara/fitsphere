// npm run share:android (runbook, "Android test build"; D-101)
// Builds the Android test APK (EAS profile "preview") for Firebase App Distribution with a new
// version name every time: apps/mobile/app.json's major and minor, then the build number EAS gives
// this build, so Firebase lists 1.0.2 (2), 1.0.3 (3) and so on. The version is written into
// app.json only while EAS takes the project, then put back, so nothing is left to commit; the
// number lives on EAS, so it never repeats. It starts a cloud build: tell the owner first (D-19).
// `npm run share:android -- --dry-run` only says which version the next build would be. Other
// arguments go to `eas build` (for example `-- --no-wait`).
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { nextShareVersion, readBuildNumber, withAppVersion } from './share-android-lib.ts';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const MOBILE = path.join(ROOT, 'apps/mobile');
const APP_JSON = path.join(MOBILE, 'app.json');
const EAS_CLI = 'eas-cli@26';
const TARGET = ['--platform', 'android', '--profile', 'preview'];

function say(text: string) {
  console.log(`share:android: ${text}`);
}

function fail(text: string): never {
  console.error(`share:android: ${text}`);
  process.exit(1);
}

const npmCli = process.env.npm_execpath;
if (!npmCli || !/npm-cli\.js$/.test(npmCli)) fail('Run this with "npm run share:android" from the repository root.');
const npxCli = path.join(path.dirname(npmCli), 'npx-cli.js');

/** Runs `npx eas-cli@26 <args>` in apps/mobile through npm's own script, with no shell. */
function eas(args: string[], captureOutput: boolean) {
  return spawnSync(process.execPath, [npxCli, '--yes', EAS_CLI, ...args], {
    cwd: MOBILE,
    stdio: captureOutput ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    encoding: 'utf8',
  });
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const buildArgs = args.filter((arg) => arg !== '--dry-run');

const original = readFileSync(APP_JSON, 'utf8');
const appVersion = String((JSON.parse(original) as { expo?: { version?: unknown } }).expo?.version);

say('Asking EAS for the last Android build number...');
const got = eas(['build:version:get', ...TARGET, '--non-interactive', '--json'], true);
const last = got.status === 0 ? readBuildNumber(got.stdout ?? '') : null;
if (last === null) fail("Couldn't read the last build number from EAS. Signed in? Try: npx eas-cli@26 whoami");

let version: string;
try {
  version = nextShareVersion(appVersion, last);
} catch (error) {
  fail((error as Error).message);
}
const buildNumber = last + 1;

if (dryRun) {
  say(`The next build would be version ${version} (${buildNumber}). Nothing changed, nothing built.`);
  process.exit(0);
}

writeFileSync(APP_JSON, withAppVersion(original, version));
// Ctrl+C reaches EAS as well; wait for it to stop so app.json is always put back.
process.on('SIGINT', () => say('Stopping; app.json is put back once EAS stops.'));
let build: ReturnType<typeof eas>;
try {
  say(`Building version ${version} (${buildNumber})...`);
  build = eas(['build', ...TARGET, ...buildArgs], false);
} finally {
  writeFileSync(APP_JSON, original);
  say('apps/mobile/app.json is back as it was.');
}
if (build.status !== 0) fail('EAS stopped with an error (see above). The next run asks EAS again for the number.');
say(`Sent to EAS as version ${version} (${buildNumber}); Firebase will list it as ${version} (${buildNumber}).`);
