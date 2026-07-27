import type { Job, JobStore } from './store.js';

export function createMemoryStore(): JobStore {
  const jobs = new Map<string, Job>();

  return {
    async create(url) {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const job: Job = { id, url, status: 'queued', createdAt: now, updatedAt: now };
      jobs.set(id, job);
      return job;
    },

    async get(id) {
      return jobs.get(id);
    },

    async update(id, updates) {
      const job = jobs.get(id);
      if (!job) return undefined;
      Object.assign(job, updates, { updatedAt: new Date().toISOString() });
      return job;
    },

    async list() {
      return Array.from(jobs.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    },
  };
}
