import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getPage } from '../browser.js';

interface FocusedElement {
  index: number;
  tagName: string;
  role: string | null;
  name: string | null;
  selector: string;
  text: string;
  tabIndex: number;
}

export function registerTabOrderTool(server: McpServer) {
  server.tool(
    'get_tab_order',
    'Simulate Tab key presses and return the focus order sequence with element details',
    {
      url: z.string().url().describe('The URL to analyze'),
      maxSteps: z.number().int().min(1).max(200).optional().default(50)
        .describe('Maximum number of Tab presses to simulate'),
    },
    async ({ url, maxSteps }) => {
      const page = await getPage();
      await page.goto(url, { waitUntil: 'networkidle' });

      // Click the body to ensure focus starts from the document
      await page.evaluate(() => document.body.focus());

      const focusOrder: FocusedElement[] = [];
      const seen = new Set<string>();

      for (let i = 0; i < maxSteps; i++) {
        await page.keyboard.press('Tab');

        const element = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return null;

          const path: string[] = [];
          let current: Element | null = el;
          while (current && current !== document.body) {
            let selector = current.tagName.toLowerCase();
            if (current.id) {
              selector += `#${current.id}`;
            } else {
              const parent = current.parentElement;
              if (parent) {
                const siblings = Array.from(parent.children).filter(
                  c => c.tagName === current!.tagName
                );
                if (siblings.length > 1) {
                  const idx = siblings.indexOf(current) + 1;
                  selector += `:nth-of-type(${idx})`;
                }
              }
            }
            path.unshift(selector);
            current = current.parentElement;
          }

          return {
            tagName: el.tagName.toLowerCase(),
            role: el.getAttribute('role'),
            name: el.getAttribute('aria-label') || el.textContent?.trim().substring(0, 80) || '',
            selector: path.join(' > '),
            tabIndex: (el as HTMLElement).tabIndex,
          };
        });

        if (!element) break;
        if (seen.has(element.selector)) break;

        seen.add(element.selector);
        focusOrder.push({
          index: i + 1,
          ...element,
          text: element.name,
          name: element.name || null,
        });
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ totalFocusableElements: focusOrder.length, focusOrder }, null, 2),
          },
        ],
      };
    },
  );
}
