import { BeforeToolCallEvent, AfterToolCallEvent } from '@strands-agents/sdk';
import { createAgent } from './index.js';
import type { AuditReport } from './schema.js';

export type AuditEventType = 'tool_start' | 'tool_complete' | 'complete' | 'error';

export interface AuditEvent {
  type: AuditEventType;
  tool?: string;
  input?: unknown;
  durationMs?: number;
  error?: string;
}

export interface AuditOptions {
  url: string;
  viewport?: { width: number; height: number };
  onEvent?: (event: AuditEvent) => void;
}

export interface AuditResult {
  url: string;
  stopReason: string;
  report: AuditReport | null;
  output: string;
  durationMs: number;
}

export async function runAudit(options: AuditOptions): Promise<AuditResult> {
  const { url, viewport, onEvent } = options;
  const { agent, mcpServers } = await createAgent();

  const start = Date.now();
  const toolTimers = new Map<string, number>();

  if (onEvent) {
    agent.addHook(BeforeToolCallEvent, (event) => {
      toolTimers.set(event.toolUse.toolUseId, Date.now());
      onEvent({
        type: 'tool_start',
        tool: event.toolUse.name,
        input: event.toolUse.input,
      });
    });

    agent.addHook(AfterToolCallEvent, (event) => {
      const startTime = toolTimers.get(event.toolUse.toolUseId);
      const durationMs = startTime ? Date.now() - startTime : undefined;
      toolTimers.delete(event.toolUse.toolUseId);
      onEvent({
        type: 'tool_complete',
        tool: event.toolUse.name,
        durationMs,
        error: event.error?.message,
      });
    });
  }

  let prompt = `Audit this URL for accessibility issues: ${url}`;
  if (viewport) {
    prompt += `\n\nFirst resize the viewport to ${viewport.width}x${viewport.height} to test at that breakpoint.`;
  }

  try {
    const result = await agent.invoke(prompt);

    const textBlocks = result.lastMessage.content
      .filter((block: any) => block.type === 'textBlock')
      .map((block: any) => block.text);

    const report = (result.structuredOutput as AuditReport) ?? null;

    return {
      url,
      stopReason: result.stopReason,
      report,
      output: textBlocks.join('\n'),
      durationMs: Date.now() - start,
    };
  } finally {
    for (const server of mcpServers) {
      await server.disconnect();
    }
  }
}
