import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getPage } from '../browser.js';

export function registerScreenshotTool(server: McpServer) {
  server.tool(
    'screenshot',
    'Capture a full-page screenshot of the given URL and return it as base64 PNG',
    {
      url: z.string().url().describe('The URL to capture'),
      fullPage: z.boolean().optional().default(false).describe('Capture the full scrollable page'),
    },
    async ({ url, fullPage }) => {
      const page = await getPage();
      await page.goto(url, { waitUntil: 'networkidle' });
      const buffer = await page.screenshot({ fullPage, type: 'png' });
      const base64 = buffer.toString('base64');

      return {
        content: [
          {
            type: 'image' as const,
            data: base64,
            mimeType: 'image/png' as const,
          },
        ],
      };
    },
  );
}
