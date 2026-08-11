interface ErrorStateProps {
  message: string;
  onRetry: () => void;
  onDismiss: () => void;
}

export function AuditErrorState({ message, onRetry, onDismiss }: ErrorStateProps) {
  return (
    <section
      role="alert"
      aria-labelledby="audit-error-heading"
      className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-950 dark:border-red-800 dark:bg-red-950 dark:text-red-100 sm:p-5"
    >
      <div className="flex gap-3">
        <span aria-hidden="true" className="text-xl">!</span>
        <div>
          <h2 id="audit-error-heading" className="font-semibold">We couldn’t complete the audit</h2>
          <p className="mt-1 text-sm text-red-800 dark:text-red-200">{message}</p>
          <p className="mt-1 text-xs text-red-700 dark:text-red-300">
            Check that the URL is reachable, then try again.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onRetry}
              className="rounded-lg bg-red-800 px-4 py-2 text-sm font-medium text-white hover:bg-red-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-800 dark:bg-red-600 dark:hover:bg-red-500"
            >
              Retry audit
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-lg px-4 py-2 text-sm font-medium underline hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function AuditLoadingSkeleton() {
  return (
    <section
      role="status"
      aria-label="Submitting audit"
      className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900 sm:p-5"
    >
      <span className="sr-only">Submitting your audit. Please wait.</span>
      <div aria-hidden="true" className="animate-pulse space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 rounded-full bg-blue-200 dark:bg-blue-800" />
          <div className="h-4 w-36 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
        <div className="space-y-2">
          <div className="h-3 w-full rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-4/5 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
    </section>
  );
}

export function MissingReportState() {
  return (
    <section className="rounded-lg border border-gray-300 bg-white p-6 text-center dark:border-gray-700 dark:bg-gray-900">
      <div aria-hidden="true" className="text-3xl">∅</div>
      <h2 className="mt-2 font-semibold">No report was returned</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-gray-600 dark:text-gray-300">
        The audit finished, but there is no report data to display. Run the audit again to retry.
      </p>
    </section>
  );
}
