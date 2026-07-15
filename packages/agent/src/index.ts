import { Agent } from '@strands-agents/sdk';
import { BedrockModel } from '@strands-agents/sdk/models/bedrock';
import { tool } from '@strands-agents/sdk';

const helloTool = tool({
  name: 'hello',
  description: 'A test tool that greets the user',
  callback: async () => {
    return { message: 'Hello from the a11y-agent!' };
  },
});

const model = new BedrockModel({
  modelId: 'us.anthropic.claude-sonnet-4-20250514',
  region: 'us-east-1',
  maxTokens: 4096,
  temperature: 0.3,
});

const agent = new Agent({
  name: 'a11y-agent',
  description: 'An AI-powered accessibility auditor',
  model,
  tools: [helloTool],
  systemPrompt: 'You are an accessibility auditing assistant. When asked to greet, use the hello tool.',
});

export { agent, model };

async function main() {
  const result = await agent.invoke('Say hello using your tool.');
  console.log('\n--- Agent Result ---');
  console.log('Stop reason:', result.stopReason);
  console.log('Last message:', JSON.stringify(result.lastMessage.content, null, 2));
}

const isDirectRun = process.argv[1]?.endsWith('index.js');
if (isDirectRun) {
  main().catch(console.error);
}
