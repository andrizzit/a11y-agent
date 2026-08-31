import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the module that audit.ts pulls createAgent from. This prevents the real
// index.ts from loading (which would construct a Bedrock/Anthropic client) and
// lets us hand runAudit a fake agent. No network, no model call, no tokens.
const invoke = vi.fn();
const disconnect = vi.fn();

vi.mock('../index.js', () => ({
  createAgent: vi.fn(async () => ({
    agent: {
      invoke,
      // runAudit only registers hooks when an onEvent callback is passed; we
      // pass none, so addHook is never called. Provide it anyway for safety.
      addHook: vi.fn(),
    },
    mcpServers: [{ disconnect }],
  })),
}));

import { runAudit } from '../audit.js';

describe('runAudit timestamp', () => {
  beforeEach(() => {
    invoke.mockReset();
    disconnect.mockReset();
  });

  it('overwrites the model-provided timestamp with the real run time', async () => {
    // The fake agent returns a report whose timestamp is a bogus, model-style
    // hallucination (the exact wrong value we saw in the live run).
    invoke.mockResolvedValue({
      stopReason: 'endTurn',
      lastMessage: { content: [{ type: 'textBlock', text: 'done' }] },
      structuredOutput: {
        url: 'https://example.com',
        timestamp: '2025-01-15T00:00:00Z', // hallucinated by the model
        findings: [],
        summary: {
          total: 0,
          critical: 0,
          major: 0,
          minor: 0,
          conformanceLevel: 'fails_A',
          topPriorities: [],
        },
      },
    });

    const before = Date.now();
    const result = await runAudit({ url: 'https://example.com' });
    const after = Date.now();

    expect(result.report).not.toBeNull();
    const ts = result.report!.timestamp;

    // Not the hallucinated value anymore.
    expect(ts).not.toBe('2025-01-15T00:00:00Z');

    // A valid ISO 8601 string...
    expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    // ...and it falls inside the window in which this test actually ran.
    const parsed = Date.parse(ts);
    expect(parsed).toBeGreaterThanOrEqual(before);
    expect(parsed).toBeLessThanOrEqual(after);

    // The MCP server was cleaned up.
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it('leaves report null when the agent produces no structured output', async () => {
    invoke.mockResolvedValue({
      stopReason: 'endTurn',
      lastMessage: { content: [{ type: 'textBlock', text: 'no structured output' }] },
      structuredOutput: undefined,
    });

    const result = await runAudit({ url: 'https://example.com' });
    expect(result.report).toBeNull();
    // Cleanup still runs on the no-report path.
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
