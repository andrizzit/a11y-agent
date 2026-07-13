import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { resizeViewport, getViewport } from '../browser.js';

export function registerResizeViewportTool(server: McpServer) {
  server.tool(
    'resize_viewport',
    'Resize the browser viewport to test responsive layouts',
    {
      width: z.number().min(320).max(3840).describe('Viewport width in pixels'),
      height: z.number().min(240).max(2160).describe('Viewport height in pixels'),
    },
    async ({ width, height }) => {
      const previous = getViewport();
      const current = await resizeViewport(width, height);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              previous,
              current,
            }, null, 2),
          },
        ],
      };
    },
  );
}
