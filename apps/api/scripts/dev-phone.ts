// npm run dev:phone (D-22 answer 5; runbook step 8)
// Starts the API, the Cloudflare Quick Tunnel to it and Expo's development server in one
// terminal, and writes the tunnel's address into apps/mobile/.env as EXPO_PUBLIC_API_URL. On
// Ctrl+C, or when any of the three stops, it stops the other two and empties that value, so an
// old address is never reused (D-19 answer 6). It never prints the address or any other .env
// value; the API's and the tunnel's output go to .dev-phone/, which git ignores.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  API_URL_NAME,
  findTunnelAddress,
  isApiHealthy,
  isTunnelConnected,
  setEnvValue,
  waitFor,
} from './dev-phone-lib.ts';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const MOBILE_ENV = path.join(ROOT, 'apps/mobile/.env');
const LOG_DIR = path.join(ROOT, '.dev-phone');
const API_PORT = 3000;
const LOCAL_API = `http://127.0.0.1:${API_PORT}`;
const START_TIMEOUT_MS = 60_000;

const children: ChildProcess[] = [];
let stopping = false;
let wroteAddress = false;

function say(text: string) {
  console.log(`dev:phone: ${text}`);
}

/** Stops every process this script started, empties the address, and exits. */
function stop(code: number, reason?: string): never {
  if (!stopping) {
    stopping = true;
    if (reason) say(reason);
    for (const child of children) stopTree(child);
    if (children.length > 0) say('Stopped the API, the tunnel and Expo.');
    if (clearAddress()) say(`${API_URL_NAME} in apps/mobile/.env is empty again.`);
  }
  process.exit(code);
}

function stopTree(child: ChildProcess) {
  if (child.pid === undefined || child.exitCode !== null) return;
  // npm starts the real process as its own child; on Windows only taskkill /T stops the tree.
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else child.kill('SIGTERM');
}

function writeAddress(address: string) {
  writeFileSync(MOBILE_ENV, setEnvValue(readFileSync(MOBILE_ENV, 'utf8'), API_URL_NAME, address));
  wroteAddress = true;
}

/** Empties the address this run wrote; returns whether it did. */
function clearAddress(): boolean {
  if (!wroteAddress || !existsSync(MOBILE_ENV)) return false;
  writeFileSync(MOBILE_ENV, setEnvValue(readFileSync(MOBILE_ENV, 'utf8'), API_URL_NAME, ''));
  wroteAddress = false;
  return true;
}

/** Runs `npm run <script> -w <workspace>` through npm's own script, with no shell. */
function startNpm(
  npmCli: string,
  [script, workspace]: [string, string],
  label: string,
  stdio: 'inherit' | number,
  env = process.env,
) {
  const child = spawn(process.execPath, [npmCli, 'run', script, '-w', workspace], {
    cwd: ROOT,
    env,
    stdio: stdio === 'inherit' ? 'inherit' : ['ignore', stdio, stdio],
  });
  watch(child, label);
  return child;
}

function watch(child: ChildProcess, name: string) {
  children.push(child);
  child.on('exit', (code) => {
    if (!stopping) stop(code ?? 1, `${name} stopped.`);
  });
}

async function main() {
  const npmCli = process.env.npm_execpath;
  if (!npmCli || !/npm-cli\.js$/.test(npmCli)) stop(1, 'Run this with "npm run dev:phone" from the repository root.');
  if (!existsSync(MOBILE_ENV)) {
    stop(1, 'apps/mobile/.env is missing. Create it from apps/mobile/.env.example first (runbook step 6).');
  }
  if (await isApiHealthy(LOCAL_API)) {
    stop(1, `An API is already running on ${LOCAL_API}. Stop it first.`);
  }
  mkdirSync(LOG_DIR, { recursive: true });

  say('Starting the API (output in .dev-phone/api.log).');
  // The port the tunnel points at. A variable already set takes precedence over the API's .env.
  startNpm(npmCli, ['dev', '@fitsphere/api'], 'The API (see .dev-phone/api.log)', openSync(path.join(LOG_DIR, 'api.log'), 'w'), {
    ...process.env,
    PORT: String(API_PORT),
  });
  if (!(await waitFor(() => isApiHealthy(LOCAL_API), START_TIMEOUT_MS))) {
    stop(1, 'The API did not start. See .dev-phone/api.log.');
  }

  say('Starting the tunnel (output in .dev-phone/tunnel.log).');
  const tunnelLog = openSync(path.join(LOG_DIR, 'tunnel.log'), 'w');
  const tunnel = spawn('cloudflared', ['tunnel', '--url', LOCAL_API], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  tunnel.on('error', () => stop(1, 'cloudflared could not be started. Is it installed (runbook, "What is needed")?'));
  watch(tunnel, 'The tunnel (see .dev-phone/tunnel.log)');
  let output = '';
  for (const stream of [tunnel.stdout, tunnel.stderr]) {
    stream?.on('data', (chunk: Buffer) => {
      output += chunk.toString();
      writeFileSync(tunnelLog, chunk);
    });
  }
  const connected = await waitFor(() => findTunnelAddress(output) !== null && isTunnelConnected(output), START_TIMEOUT_MS, 500);
  const address = findTunnelAddress(output);
  if (!connected || !address) stop(1, 'The tunnel did not come up. See .dev-phone/tunnel.log.');

  writeAddress(address);
  say(`Tunnel ready; its address is in apps/mobile/.env (${API_URL_NAME}).`);
  if (await waitFor(() => isApiHealthy(address), START_TIMEOUT_MS)) {
    say('The API answers through the tunnel.');
  } else {
    // A new Quick Tunnel can take a while to answer from this PC; the phone may still reach it.
    say('The API did not answer through the tunnel from this PC yet. If the app shows "API: unreachable", stop and run again.');
  }

  say('Starting Expo. Press Ctrl+C to stop everything.');
  startNpm(npmCli, ['start', '@fitsphere/mobile'], 'Expo', 'inherit');
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
// A last guard if the script ends any other way.
process.on('exit', () => clearAddress());

await main().catch((error: unknown) => stop(1, `Failed: ${error instanceof Error ? error.message : String(error)}`));
