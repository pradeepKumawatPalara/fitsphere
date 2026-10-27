import { buildApp } from './app.ts';

const port = Number(process.env.PORT ?? '3000');
const app = buildApp({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });

// Loopback only: the Android emulator reaches it at 10.0.2.2, and it stays off the local network.
await app.listen({ host: '127.0.0.1', port });
