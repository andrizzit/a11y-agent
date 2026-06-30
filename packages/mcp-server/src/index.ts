import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

export const server = new McpServer({
  name: 'a11y-agent-mcp',
  version: '0.1.0',
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();
