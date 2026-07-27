import type { Job, JobStatus } from './jobs.js';

export interface JobStore {
  create(url: string): Promise<Job>;
  get(id: string): Promise<Job | undefined>;
  update(id: string, updates: Partial<Omit<Job, 'id' | 'createdAt'>>): Promise<Job | undefined>;
  list(): Promise<Job[]>;
}

export type { Job, JobStatus };
