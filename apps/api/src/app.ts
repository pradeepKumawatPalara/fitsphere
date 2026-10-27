import Fastify, { LogController, type FastifyServerOptions } from 'fastify';
import { API_BASE_PATH } from '@fitsphere/shared';

export function buildApp(options: Pick<FastifyServerOptions, 'logger'> = {}) {
  const app = Fastify({
    logger: options.logger ?? false,
    // Fastify's default request log includes the full URL with query values, which the
    // log rule forbids (api-conventions, "Logging"). The API writes its own request line.
    logController: new LogController({ disableRequestLogging: true }),
    bodyLimit: 100 * 1024,
  });

  app.get(`${API_BASE_PATH}/health`, async () => ({ status: 'ok' }));

  return app;
}
