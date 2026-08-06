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
  critical: 'bg-red-100 text-red-800 border-red-200',
  major: 'bg-orange-100 text-orange-800 border-orange-200',
  minor: 'bg-yellow-100 text-yellow-800 border-yellow-200',
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
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Audit Output</h2>
        <pre className="whitespace-pre-wrap text-sm text-gray-700 overflow-auto max-h-96">
          {typeof report === 'string' ? report : JSON.stringify(report, null, 2)}
        </pre>
      </div>
    );
  }

  const { findings, summary } = report;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Summary</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{summary.total}</div>
            <div className="text-xs text-gray-500">Total Issues</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{summary.critical}</div>
            <div className="text-xs text-gray-500">Critical</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{summary.major}</div>
            <div className="text-xs text-gray-500">Major</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{summary.minor}</div>
            <div className="text-xs text-gray-500">Minor</div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-4 text-sm">
          <span className="rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-700">
            {levelBadge[summary.conformanceLevel] ?? summary.conformanceLevel}
          </span>
        </div>
        {summary.topPriorities.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-1">Top Priorities</h3>
            <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
              {summary.topPriorities.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ol>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">
          Findings ({findings.length})
        </h2>
        {findings.map((finding, i) => (
          <FindingCard key={i} finding={finding} index={i + 1} />
        ))}
      </div>
    </div>
  );
}

function FindingCard({ finding, index }: { finding: Finding; index: number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="text-sm font-mono text-gray-400 mt-0.5">#{index}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium border ${severityColors[finding.severity]}`}>
              {finding.severity}
            </span>
            <span className="text-xs text-gray-500 font-mono">
              {finding.wcagCriteria}
            </span>
            <span className="text-xs text-gray-400">
              Level {finding.wcagLevel}
            </span>
            {finding.confidence && (
              <span className="text-xs text-gray-400">
                ({finding.confidence} confidence)
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-gray-900">{finding.issue}</p>
          <p className="mt-1 text-xs text-gray-500 font-mono truncate" title={finding.element}>
            {finding.element}
          </p>
          <details className="mt-2">
            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
              Evidence & suggestion
            </summary>
            <div className="mt-2 space-y-2 text-sm">
              <p className="text-gray-600">
                <span className="font-medium">Evidence:</span> {finding.evidence}
              </p>
              <p className="text-gray-600">
                <span className="font-medium">Fix:</span> {finding.suggestion}
              </p>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
