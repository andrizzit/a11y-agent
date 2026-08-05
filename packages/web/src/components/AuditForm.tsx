import { useState, type FormEvent } from 'react';
import { useAuditStream } from '../hooks/useAuditStream.ts';
import { AuditProgress } from './AuditProgress.tsx';

export function AuditForm() {
  const [url, setUrl] = useState('');
  const { status, events, error, report, startAudit, reset } = useAuditStream();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    startAudit(url);
  }

  const isActive = status === 'submitting' || status === 'running';

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="flex gap-3">
        <label htmlFor="url-input" className="sr-only">
          URL to audit
        </label>
        <input
          id="url-input"
          type="url"
          required
          placeholder="https://example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition"
          disabled={isActive}
        />
        <button
          type="submit"
          disabled={isActive}
          className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-200 outline-none transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isActive ? 'Auditing...' : 'Audit'}
        </button>
      </form>

      {error && (
        <div role="alert" className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
          <button
            onClick={reset}
            className="ml-3 underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      )}

      {isActive && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <AuditProgress events={events} />
        </div>
      )}

      {status === 'complete' && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          Audit complete!
          <button
            onClick={reset}
            className="ml-3 underline hover:no-underline"
          >
            Run another
          </button>
        </div>
      )}
    </div>
  );
}
