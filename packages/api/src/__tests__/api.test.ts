import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { createMemoryStore } from '../store-memory.js';
import { auditsRoutes } from '../routes/audits.js';
import { streamRoutes } from '../routes/stream.js';
import type { JobStore } from '../store.js';

declare module 'fastify' {
  interface FastifyInstance {
    store: JobStore;
  }
}

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify();
  const store = createMemoryStore();
  app.decorate('store', store);
  await app.register(cors);
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
  await app.register(auditsRoutes);
  await app.register(streamRoutes);
  app.get('/health', async () => ({ status: 'ok' }));
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('GET /health', () => {
  it('returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });
});

describe('POST /audits', () => {
  it('creates a job and returns 202', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/audits',
      payload: { url: 'https://example.com' },
    });
    expect(res.statusCode).toBe(202);
    const body = res.json();
    expect(body.id).toBeDefined();
    expect(body.url).toBe('https://example.com');
    expect(body.status).toBe('queued');
    expect(body.createdAt).toBeDefined();
  });

  it('accepts viewport option', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/audits',
      payload: { url: 'https://example.com', viewport: { width: 375, height: 667 } },
    });
    expect(res.statusCode).toBe(202);
  });

  it('rejects invalid URL', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/audits',
      payload: { url: 'not-a-url' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects missing URL', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/audits',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /audits/:id', () => {
  it('returns a job by id', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/audits',
      payload: { url: 'https://example.com' },
    });
    const job = create.json();

    const res = await app.inject({ method: 'GET', url: `/audits/${job.id}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(job.id);
  });

  it('returns 404 for unknown id', async () => {
    const res = await app.inject({ method: 'GET', url: '/audits/nonexistent-id' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('Job not found');
  });
});

describe('GET /audits', () => {
  it('returns list of jobs', async () => {
    const res = await app.inject({ method: 'GET', url: '/audits' });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
    expect(res.json().length).toBeGreaterThan(0);
  });
});

describe('GET /audits/:id/stream', () => {
  it('returns SSE headers for existing job', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/audits',
      payload: { url: 'https://example.com' },
    });
    const job = create.json();

    const res = await app.inject({ method: 'GET', url: `/audits/${job.id}/stream` });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('text/event-stream');
  });

  it('returns 404 for unknown job', async () => {
    const res = await app.inject({ method: 'GET', url: '/audits/bad-id/stream' });
    expect(res.statusCode).toBe(404);
  });
});

describe('auth middleware', () => {
  it('blocks requests when API_KEYS is set', async () => {
    const authedApp = Fastify();
    authedApp.decorate('store', createMemoryStore());
    // Simulate auth with keys
    const keys = new Set(['test-key']);
    authedApp.addHook('onRequest', async (request, reply) => {
      const key = request.headers['x-api-key'];
      if (!key || !keys.has(key as string)) {
        reply.status(401).send({ error: 'Invalid or missing API key' });
      }
    });
    authedApp.get('/test', async () => ({ ok: true }));
    await authedApp.ready();

    const noKey = await authedApp.inject({ method: 'GET', url: '/test' });
    expect(noKey.statusCode).toBe(401);

    const goodKey = await authedApp.inject({
      method: 'GET',
      url: '/test',
      headers: { 'x-api-key': 'test-key' },
    });
    expect(goodKey.statusCode).toBe(200);

    await authedApp.close();
  });
});
