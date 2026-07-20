import { createAgent } from './index.js';

export interface AuditOptions {
  url: string;
  viewport?: { width: number; height: number };
}

export interface AuditResult {
  url: string;
  stopReason: string;
  output: string;
  durationMs: number;
}

export async function runAudit(options: AuditOptions): Promise<AuditResult> {
  const { url, viewport } = options;
  const { agent, mcpServers } = await createAgent();

  const start = Date.now();

  let prompt = `Audit this URL for accessibility issues: ${url}`;
  if (viewport) {
    prompt += `\n\nFirst resize the viewport to ${viewport.width}x${viewport.height} to test at that breakpoint.`;
  }

  try {
    const result = await agent.invoke(prompt);

    const textBlocks = result.lastMessage.content
      .filter((block: any) => block.type === 'textBlock')
      .map((block: any) => block.text);

    return {
      url,
      stopReason: result.stopReason,
      output: textBlocks.join('\n'),
      durationMs: Date.now() - start,
    };
  } finally {
    for (const server of mcpServers) {
      await server.disconnect();
    }
  }
}
