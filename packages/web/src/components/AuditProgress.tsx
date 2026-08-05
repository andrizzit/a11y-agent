import type { StreamEvent } from '../hooks/useAuditStream.ts';

interface Props {
  events: StreamEvent[];
}

const toolLabels: Record<string, string> = {
  navigate: 'Loading page',
  screenshot: 'Capturing screenshot',
  get_accessibility_tree: 'Reading accessibility tree',
  get_tab_order: 'Checking keyboard navigation',
  check_contrast: 'Checking color contrast',
  check_heading_hierarchy: 'Validating headings',
  simulate_screen_reader: 'Simulating screen reader',
  check_focus_visible: 'Checking focus indicators',
  interact: 'Testing interactions',
  resize_viewport: 'Resizing viewport',
};

export function AuditProgress({ events }: Props) {
  const toolEvents = events.filter(e => e.type === 'tool_start' || e.type === 'tool_complete');

  if (toolEvents.length === 0) {
    return (
      <div className="flex items-center gap-3 text-sm text-gray-600">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
        Starting audit...
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {toolEvents.map((event, i) => {
        const toolName = event.data.tool as string;
        const label = toolLabels[toolName] ?? toolName;
        const isStart = event.type === 'tool_start';
        const duration = event.data.durationMs as number | undefined;

        return (
          <li key={i} className="flex items-center gap-3 text-sm">
            {isStart ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
            ) : (
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-green-100 text-green-600 text-xs">
                ✓
              </span>
            )}
            <span className={isStart ? 'text-gray-700' : 'text-gray-500'}>
              {label}
            </span>
            {duration && (
              <span className="text-xs text-gray-400">
                {(duration / 1000).toFixed(1)}s
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
