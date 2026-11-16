import { promisify } from 'node:util';
import { gzip } from 'node:zlib';
import type { FastifyReply, FastifyRequest } from 'fastify';

const gzipAsync = promisify(gzip);

/**
 * Sends a large JSON body (the food list, 6 MB since D-102's units; the exercise list) gzipped when
 * the client accepts gzip: about a tenth of the size. The phone asks for it (OkHttp and iOS's URL
 * loading add "Accept-Encoding: gzip" and unpack it unseen); the PC sends it to the phone through the
 * tunnel, often over a phone's hotspot, where 6 MB took longer than the phone waits (2026-11-16).
 * Otherwise the body goes as it is.
 */
export async function sendLargeJson(request: FastifyRequest, reply: FastifyReply, body: unknown): Promise<unknown> {
  void reply.header('vary', 'accept-encoding');
  if (!acceptsGzip(request.headers['accept-encoding'])) return body;
  const packed = await gzipAsync(JSON.stringify(body));
  return reply.header('content-type', 'application/json; charset=utf-8').header('content-encoding', 'gzip').send(packed);
}

/** Whether an Accept-Encoding header takes gzip: named, and not with q=0. */
export function acceptsGzip(header: string | string[] | undefined): boolean {
  const text = Array.isArray(header) ? header.join(',') : (header ?? '');
  return text.split(',').some((part) => {
    const [name, ...params] = part.trim().toLowerCase().split(';');
    if (name?.trim() !== 'gzip' && name?.trim() !== '*') return false;
    const q = params.map((param) => param.trim()).find((param) => param.startsWith('q='));
    return q === undefined || Number(q.slice(2)) > 0;
  });
}
