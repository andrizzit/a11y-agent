import { useState, useCallback, useRef } from 'react';

export type StreamEventType = 'status_change' | 'tool_start' | 'tool_complete' | 'complete' | 'error';

export interface StreamEvent {
  jobId: string;
  type: StreamEventType;
  timestamp: string;
  data: Record<string, unknown>;
}

export type AuditStatus = 'idle' | 'submitting' | 'running' | 'complete' | 'failed';

export interface AuditStreamState {
  status: AuditStatus;
  jobId: string | null;
  events: StreamEvent[];
  error: string | null;
  report: unknown | null;
}

export function useAuditStream() {
  const [state, setState] = useState<AuditStreamState>({
    status: 'idle',
    jobId: null,
    events: [],
    error: null,
    report: null,
  });
  const eventSourceRef = useRef<EventSource | null>(null);

  const startAudit = useCallback(async (url: string) => {
    // Clean up previous stream
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setState({ status: 'submitting', jobId: null, events: [], error: null, report: null });

    try {
      const res = await fetch('/api/audits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        const data: unknown = await res.json().catch(() => null);
        const message = typeof data === 'object' && data !== null && 'message' in data &&
          typeof data.message === 'string'
          ? data.message
          : `Request failed (${res.status})`;
        throw new Error(message);
      }

      const job: unknown = await res.json();
      if (typeof job !== 'object' || job === null || !('id' in job) || typeof job.id !== 'string') {
        throw new Error('The server returned an invalid audit response');
      }
      setState(s => ({ ...s, status: 'running', jobId: job.id }));

      // Connect to SSE stream
      const es = new EventSource(`/api/audits/${job.id}/stream`);
      eventSourceRef.current = es;

      const handleEvent = (e: MessageEvent) => {
        const event: StreamEvent = JSON.parse(e.data);
        setState(s => ({ ...s, events: [...s.events, event] }));

        if (event.type === 'complete') {
          setState(s => ({
            ...s,
            status: 'complete',
            report: event.data.report ?? null,
          }));
          es.close();
        } else if (event.type === 'error') {
          setState(s => ({
            ...s,
            status: 'failed',
            error: typeof event.data.error === 'string' ? event.data.error : 'Audit failed',
          }));
          es.close();
        }
      };

      es.addEventListener('status_change', handleEvent);
      es.addEventListener('tool_start', handleEvent);
      es.addEventListener('tool_complete', handleEvent);
      es.addEventListener('complete', handleEvent);
      es.addEventListener('error', handleEvent);

      es.onerror = () => {
        setState(s => {
          if (s.status === 'running') {
            return { ...s, status: 'failed', error: 'Connection lost' };
          }
          return s;
        });
        es.close();
      };
    } catch (err) {
      setState(s => ({
        ...s,
        status: 'failed',
        error: err instanceof Error ? err.message : 'Something went wrong',
      }));
    }
  }, []);

  const reset = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setState({ status: 'idle', jobId: null, events: [], error: null, report: null });
  }, []);

  return { ...state, startAudit, reset };
}
