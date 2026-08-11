interface Finding {
  issue: string;
  severity: 'critical' | 'major' | 'minor';
  wcagCriteria: string;
  wcagLevel: string;
  element: string;
  evidence: string;
  suggestion: string;
  confidence?: 'high' | 'moderate';
}

interface AuditReport {
  url: string;
  timestamp: string;
  findings: Finding[];
  summary: {
    total: number;
    critical: number;
    major: number;
    minor: number;
    conformanceLevel: string;
    topPriorities: string[];
  };
}

interface Props {
  report: unknown;
}

const severityColors = {
  critical: 'bg-red-100 text-red-900 border-red-300 dark:bg-red-950 dark:text-red-200 dark:border-red-800',
  major: 'bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-950 dark:text-orange-200 dark:border-orange-800',
  minor: 'bg-yellow-100 text-yellow-900 border-yellow-300 dark:bg-yellow-950 dark:text-yellow-200 dark:border-yellow-800',
};

const levelBadge: Record<string, string> = {
  fails_A: 'Fails Level A',
  A: 'Level A',
  AA: 'Level AA',
  AAA: 'Level AAA',
};

function isAuditReport(value: unknown): value is AuditReport {
  return (
    typeof value === 'object' &&
    value !== null &&
    'findings' in value &&
    'summary' in value
  );
}

export function AuditResults({ report }: Props) {
  if (!isAuditReport(report)) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <h2 className="mb-2 text-lg font-semibold">Audit Output</h2>
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words text-sm text-gray-700 dark:text-gray-200">
          {typeof report === 'string' ? report : JSON.stringify(report, null, 2)}
        </pre>
      </div>
    );
  }

  const { findings, summary } = report;

  return (
    <div className="space-y-6">
      <section aria-labelledby="summary-heading" className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900 sm:p-5">
        <h2 id="summary-heading" className="mb-3 text-lg font-semibold">Summary</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{summary.total}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Total Issues</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-700 dark:text-red-400">{summary.critical}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Critical</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-700 dark:text-orange-400">{summary.major}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Major</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{summary.minor}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Minor</div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-4 text-sm">
          <span className="rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-200">
            {levelBadge[summary.conformanceLevel] ?? summary.conformanceLevel}
          </span>
        </div>
        {summary.topPriorities.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-200">Top Priorities</h3>
            <ol className="list-inside list-decimal space-y-1 text-sm text-gray-600 dark:text-gray-300">
              {summary.topPriorities.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ol>
          </div>
        )}
      </section>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">
          Findings ({findings.length})
        </h2>
        {findings.length === 0 ? (
          <section className="rounded-lg border border-green-300 bg-green-50 p-6 text-center dark:border-green-800 dark:bg-green-950">
            <div aria-hidden="true" className="text-3xl text-green-700 dark:text-green-400">✓</div>
            <h3 className="mt-2 font-semibold text-green-950 dark:text-green-100">No accessibility issues found</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-green-800 dark:text-green-200">
              The automated audit did not detect any issues. Manual testing is still recommended for complete coverage.
            </p>
          </section>
        ) : (
          findings.map((finding, i) => (
            <FindingCard key={i} finding={finding} index={i + 1} />
          ))
        )}
      </div>
    </div>
  );
}

function FindingCard({ finding, index }: { finding: Finding; index: number }) {
  return (
    <article className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900 sm:p-5" aria-labelledby={`finding-${index}`}>
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="mt-0.5 font-mono text-sm text-gray-500 dark:text-gray-400">#{index}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium border ${severityColors[finding.severity]}`}>
              {finding.severity}
            </span>
            <span className="font-mono text-xs text-gray-600 dark:text-gray-300">
              {finding.wcagCriteria}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Level {finding.wcagLevel}
            </span>
            {finding.confidence && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                ({finding.confidence} confidence)
              </span>
            )}
          </div>
          <h3 id={`finding-${index}`} className="text-sm font-medium">{finding.issue}</h3>
          <p className="mt-1 break-all font-mono text-xs text-gray-600 dark:text-gray-300">
            {finding.element}
          </p>
          <details className="mt-2">
            <summary className="cursor-pointer rounded text-xs text-gray-600 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-gray-300 dark:hover:text-white">
              Evidence & suggestion
            </summary>
            <div className="mt-2 space-y-2 text-sm">
              <p className="text-gray-600 dark:text-gray-300">
                <span className="font-medium">Evidence:</span> {finding.evidence}
              </p>
              <p className="text-gray-600 dark:text-gray-300">
                <span className="font-medium">Fix:</span> {finding.suggestion}
              </p>
            </div>
          </details>
        </div>
      </div>
    </article>
  );
}
