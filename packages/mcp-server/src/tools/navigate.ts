import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { navigate } from '../browser.js';

export function registerNavigateTool(server: McpServer) {
  server.tool(
    'navigate',
    'Navigate the browser to a URL',
    {
      url: z.string().url().describe('The URL to navigate to'),
      waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle']).optional().describe('When to consider navigation complete (default: networkidle)'),
    },
    async ({ url, waitUntil }) => {
      const result = await navigate(url, waitUntil ?? 'networkidle');

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  );
}
