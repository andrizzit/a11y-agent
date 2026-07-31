import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { createStore } from './store-factory.js';
import { auditsRoutes } from './routes/audits.js';
import { streamRoutes } from './routes/stream.js';
import { apiKeyAuth } from './auth.js';
import type { JobStore } from './store.js';

declare module 'fastify' {
  interface FastifyInstance {
    store: JobStore;
  }
}

const app = Fastify({ logger: true });

const store = createStore();
app.decorate('store', store);

await app.register(cors, { origin: true });
await app.register(rateLimit, {
  max: parseInt(process.env.RATE_LIMIT_MAX ?? '100', 10),
  timeWindow: '1 minute',
});

app.addHook('onRequest', apiKeyAuth);

await app.register(auditsRoutes);
await app.register(streamRoutes);

app.get('/health', async () => ({ status: 'ok' }));

const port = parseInt(process.env.PORT ?? '3000', 10);
const host = process.env.HOST ?? '0.0.0.0';

await app.listen({ port, host });
