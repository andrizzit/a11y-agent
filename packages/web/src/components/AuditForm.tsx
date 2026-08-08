import { useState, type FormEvent } from 'react';
import { useAuditStream } from '../hooks/useAuditStream.ts';
import { AuditProgress } from './AuditProgress.tsx';
import { AuditResults } from './AuditResults.tsx';

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
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="url-input" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">
            URL to audit
          </label>
          <input
            id="url-input"
            type="url"
            required
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            inputMode="url"
            autoComplete="url"
            aria-describedby="url-help"
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 placeholder-gray-500 outline-none transition focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/30 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:placeholder-gray-400"
            disabled={isActive}
          />
          <p id="url-help" className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">Include http:// or https://</p>
        </div>
        <button
          type="submit"
          disabled={isActive}
          className="min-h-12 rounded-lg bg-blue-700 px-6 py-3 font-medium text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-500 sm:mb-[1.375rem]"
        >
          {isActive ? 'Auditing...' : 'Audit'}
        </button>
      </form>

      {error && (
        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
          <button
            onClick={reset}
            className="ml-3 rounded underline hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          >
            Try again
          </button>
        </div>
      )}

      {isActive && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900" aria-live="polite" aria-atomic="false">
          <AuditProgress events={events} />
        </div>
      )}

      {status === 'complete' && (
        <div className="space-y-4">
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span role="status" className="text-sm font-medium text-green-700 dark:text-green-400">Audit complete</span>
            <button
              onClick={reset}
              className="rounded text-sm text-blue-700 underline hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-blue-400"
            >
              Run another audit
            </button>
          </div>
          {report != null && <AuditResults report={report} />}
        </div>
      )}
    </div>
  );
}
