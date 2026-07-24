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

const jobs = new Map<string, Job>();

export function createJob(url: string): Job {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const job: Job = {
    id,
    url,
    status: 'queued',
    createdAt: now,
    updatedAt: now,
  };
  jobs.set(id, job);
  return job;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export function updateJob(id: string, updates: Partial<Omit<Job, 'id' | 'createdAt'>>): Job | undefined {
  const job = jobs.get(id);
  if (!job) return undefined;
  Object.assign(job, updates, { updatedAt: new Date().toISOString() });
  return job;
}

export function listJobs(): Job[] {
  return Array.from(jobs.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}
