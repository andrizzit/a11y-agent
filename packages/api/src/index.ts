import Fastify from 'fastify';
import cors from '@fastify/cors';
import { auditsRoutes } from './routes/audits.js';

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(auditsRoutes);

app.get('/health', async () => ({ status: 'ok' }));

const port = parseInt(process.env.PORT ?? '3000', 10);
const host = process.env.HOST ?? '0.0.0.0';

await app.listen({ port, host });
console.log(`Server running on http://${host}:${port}`);
