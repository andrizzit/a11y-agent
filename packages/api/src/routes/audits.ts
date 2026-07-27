import type { FastifyInstance } from 'fastify';
import type { JobStore } from '../store.js';
import { runAudit } from '@a11y-agent/agent';

export async function auditsRoutes(app: FastifyInstance) {
  const store: JobStore = app.store;

  app.post<{ Body: { url: string; viewport?: { width: number; height: number } } }>(
    '/audits',
    {
      schema: {
        body: {
          type: 'object',
          required: ['url'],
          properties: {
            url: { type: 'string', format: 'uri' },
            viewport: {
              type: 'object',
              properties: {
                width: { type: 'number', minimum: 320, maximum: 3840 },
                height: { type: 'number', minimum: 240, maximum: 2160 },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { url, viewport } = request.body;
      const job = await store.create(url);

      setImmediate(async () => {
        await store.update(job.id, { status: 'running' });
        try {
          const result = await runAudit({ url, viewport });
          await store.update(job.id, {
            status: 'complete',
            report: result.report ?? result.output,
          });
        } catch (err) {
          await store.update(job.id, {
            status: 'failed',
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      });

      return reply.status(202).send(job);
    },
  );

  app.get<{ Params: { id: string } }>(
    '/audits/:id',
    async (request, reply) => {
      const job = await store.get(request.params.id);
      if (!job) {
        return reply.status(404).send({ error: 'Job not found' });
      }
      return job;
    },
  );

  app.get('/audits', async () => {
    return store.list();
  });
}
