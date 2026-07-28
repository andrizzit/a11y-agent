import Fastify from 'fastify';
import cors from '@fastify/cors';
import { createStore } from './store-factory.js';
import { auditsRoutes } from './routes/audits.js';
import { streamRoutes } from './routes/stream.js';
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
await app.register(auditsRoutes);
await app.register(streamRoutes);

app.get('/health', async () => ({ status: 'ok' }));

const port = parseInt(process.env.PORT ?? '3000', 10);
const host = process.env.HOST ?? '0.0.0.0';

await app.listen({ port, host });
