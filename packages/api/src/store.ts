export type JobStatus = 'queued' | 'running' | 'complete' | 'failed';

export interface Job {
  id: string;
  url: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  report?: unknown;
  error?: string;
}

export interface JobStore {
  create(url: string): Promise<Job>;
  get(id: string): Promise<Job | undefined>;
  update(id: string, updates: Partial<Omit<Job, 'id' | 'createdAt'>>): Promise<Job | undefined>;
  list(): Promise<Job[]>;
}
