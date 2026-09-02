import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Agent, McpClient } from '@strands-agents/sdk';
import { BedrockModel } from '@strands-agents/sdk/models/bedrock';
import { AnthropicModel } from '@strands-agents/sdk/models/anthropic';
import { SYSTEM_PROMPT } from './system-prompt.js';
import { AuditReportSchema } from './schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const mcpServerPath = resolve(__dirname, '../../mcp-server/dist/index.js');

// Model backend is selectable so the agent can run against Anthropic's direct
// API (no AWS account throttle) as well as Bedrock. Defaults to Bedrock, so the
// existing deployment path is unchanged unless MODEL_PROVIDER=anthropic is set.
const modelProvider = process.env.MODEL_PROVIDER ?? 'bedrock';

const model =
  modelProvider === 'anthropic'
    ? new AnthropicModel({
        apiKey: process.env.ANTHROPIC_API_KEY,
        // Anthropic's DIRECT API uses different model IDs than Bedrock and
        // retired claude-sonnet-4-20250514 (2026-06-15) — sending it returns
        // not_found_error. Default to the current, verified Sonnet 4.5.
        modelId: process.env.ANTHROPIC_MODEL_ID ?? 'claude-sonnet-4-5-20250929',
        maxTokens: 4096,
        temperature: 0.3,
        // Identity-linked ("all workspaces") keys must name the workspace on
        // every request. Sent as a default header when ANTHROPIC_WORKSPACE_ID is set.
        ...(process.env.ANTHROPIC_WORKSPACE_ID
          ? {
              clientConfig: {
                defaultHeaders: {
                  'anthropic-workspace-id': process.env.ANTHROPIC_WORKSPACE_ID,
                },
              },
            }
          : {}),
      })
    : new BedrockModel({
        modelId: process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-sonnet-4-20250514-v1:0',
        region: process.env.AWS_REGION ?? 'us-east-1',
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

export { runAudit, type AuditOptions, type AuditResult, type AuditEvent, type AuditEventType } from './audit.js';
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

const isDirectRun = process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch(console.error);
}
