import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Agent, McpClient } from '@strands-agents/sdk';
import { BedrockModel } from '@strands-agents/sdk/models/bedrock';
import { SYSTEM_PROMPT } from './system-prompt.js';
import { AuditReportSchema } from './schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const mcpServerPath = resolve(__dirname, '../../mcp-server/dist/index.js');

const model = new BedrockModel({
  modelId: 'us.anthropic.claude-sonnet-4-20250514',
  region: 'us-east-1',
  maxTokens: 4096,
  temperature: 0.3,
});

export async function createAgent() {
  const mcpServers = await McpClient.loadServers({
    'a11y-mcp': {
      command: 'node',
      args: [mcpServerPath],
    },
  });

  const agent = new Agent({
    name: 'a11y-agent',
    description: 'An AI-powered accessibility auditor',
    model,
    tools: mcpServers,
    systemPrompt: SYSTEM_PROMPT,
    structuredOutputSchema: AuditReportSchema,
  });

  return { agent, mcpServers };
}

export { runAudit, type AuditOptions, type AuditResult } from './audit.js';
export { AuditReportSchema, FindingSchema, type AuditReport, type Finding } from './schema.js';

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error('Usage: node dist/index.js <url>');
    process.exit(1);
  }

  const { runAudit } = await import('./audit.js');
  const result = await runAudit({ url });

  console.log('\n--- Audit Result ---');
  console.log('URL:', result.url);
  console.log('Duration:', `${(result.durationMs / 1000).toFixed(1)}s`);
  console.log('Stop reason:', result.stopReason);

  if (result.report) {
    console.log('\n--- Structured Report ---');
    console.log(JSON.stringify(result.report, null, 2));
  } else {
    console.log('\n--- Raw Output ---');
    console.log(result.output);
  }
}

const isDirectRun = process.argv[1]?.endsWith('index.js');
if (isDirectRun) {
  main().catch(console.error);
}
