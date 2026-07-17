import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Agent, McpClient } from '@strands-agents/sdk';
import { BedrockModel } from '@strands-agents/sdk/models/bedrock';
import { SYSTEM_PROMPT } from './system-prompt.js';

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
  });

  return { agent, mcpServers };
}

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error('Usage: node dist/index.js <url>');
    process.exit(1);
  }

  const { agent, mcpServers } = await createAgent();

  try {
    const result = await agent.invoke(`Audit this URL for accessibility issues: ${url}`);
    console.log('\n--- Agent Result ---');
    console.log('Stop reason:', result.stopReason);
  } finally {
    for (const server of mcpServers) {
      await server.disconnect();
    }
  }
}

const isDirectRun = process.argv[1]?.endsWith('index.js');
if (isDirectRun) {
  main().catch(console.error);
}
