import { EventEmitter } from 'node:events';

export type AuditEventType =
  | 'status_change'
  | 'tool_start'
  | 'tool_complete'
  | 'finding'
  | 'error'
  | 'complete';

export interface AuditEvent {
  jobId: string;
  type: AuditEventType;
  timestamp: string;
  data: unknown;
}

class AuditEventBus extends EventEmitter {
  emit(jobId: string, event: Omit<AuditEvent, 'jobId' | 'timestamp'>): boolean {
    const full: AuditEvent = {
      jobId,
      timestamp: new Date().toISOString(),
      ...event,
    };
    return super.emit(jobId, full);
  }

  subscribe(jobId: string, handler: (event: AuditEvent) => void): () => void {
    this.on(jobId, handler);
    return () => this.off(jobId, handler);
  }
}

export const auditEvents = new AuditEventBus();
