import type { FastifyRequest, FastifyReply } from 'fastify';

const API_KEYS = new Set(
  (process.env.API_KEYS ?? '').split(',').map(k => k.trim()).filter(Boolean)
);

const authEnabled = API_KEYS.size > 0;

export async function apiKeyAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!authEnabled) return;

  const apiKeyHeader = request.headers['x-api-key'];
  const authHeader = request.headers['authorization'];
  const key = (Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader)
    ?? (typeof authHeader === 'string' ? authHeader.replace('Bearer ', '') : undefined);

  if (!key || !API_KEYS.has(key)) {
    reply.status(401).send({ error: 'Invalid or missing API key' });
  }
}
