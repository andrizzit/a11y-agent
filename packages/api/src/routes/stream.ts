import type { FastifyInstance } from 'fastify';
import type { JobStore } from '../store.js';
import { auditEvents, type AuditEvent } from '../events.js';

export async function streamRoutes(app: FastifyInstance) {
  const store: JobStore = app.store;

  app.get<{ Params: { id: string } }>(
    '/audits/:id/stream',
    async (request, reply) => {
      const job = await store.get(request.params.id);
      if (!job) {
        return reply.status(404).send({ error: 'Job not found' });
      }

      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      const send = (event: AuditEvent) => {
        reply.raw.write(`event: ${event.type}\n`);
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
      };

      // Send current state immediately
      send({
        jobId: job.id,
        type: 'status_change',
        timestamp: job.updatedAt,
        data: { status: job.status },
      });

      // If already terminal, close
      if (job.status === 'complete' || job.status === 'failed') {
        send({
          jobId: job.id,
          type: 'complete',
          timestamp: job.updatedAt,
          data: { status: job.status, report: job.report, error: job.error },
        });
        reply.raw.end();
        return;
      }

      const unsubscribe = auditEvents.subscribe(job.id, (event) => {
        send(event);
        if (event.type === 'complete' || event.type === 'error') {
          reply.raw.end();
        }
      });

      request.raw.on('close', () => {
        unsubscribe();
      });
    },
  );
}
