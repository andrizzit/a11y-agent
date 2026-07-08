import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getPage } from '../browser.js';

interface Announcement {
  role: string;
  name: string;
  description?: string;
  value?: string;
  states?: string[];
  level?: number;
}

interface AXNode {
  ignored?: boolean;
  role?: { value: string };
  name?: { value: string };
  description?: { value: string };
  value?: { value: string };
  properties?: Array<{ name: string; value: { value: unknown } }>;
}

export function registerSimulateScreenReaderTool(server: McpServer) {
  server.tool(
    'simulate_screen_reader',
    'Simulate screen reader announcements for a page or region',
    {
      url: z.string().url().describe('The URL to analyze'),
      selector: z.string().optional().describe('CSS selector to scope to a specific region (uses aria-snapshot)'),
    },
    async ({ url, selector }) => {
      const page = await getPage();
      await page.goto(url, { waitUntil: 'networkidle' });

      if (selector) {
        const ariaOutput = await page.locator(selector).first().ariaSnapshot();
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ region: selector, announcements: ariaOutput.split('\n') }, null, 2) }],
        };
      }

      const client = await page.context().newCDPSession(page);
      const { nodes } = await client.send('Accessibility.getFullAXTree');

      const announcements: Announcement[] = [];

      for (const node of nodes as AXNode[]) {
        if (node.ignored) continue;

        const role = node.role?.value;
        if (!role || role === 'none' || role === 'generic' || role === 'InlineTextBox') continue;
        if (role === 'StaticText') {
          if (node.name?.value) {
            announcements.push({ role: 'text', name: node.name.value });
          }
          continue;
        }

        const announcement: Announcement = {
          role,
          name: node.name?.value || '',
        };

        if (node.description?.value) {
          announcement.description = node.description.value;
        }
        if (node.value?.value) {
          announcement.value = node.value.value;
        }

        const states: string[] = [];
        if (node.properties) {
          for (const prop of node.properties) {
            switch (prop.name) {
              case 'level':
                announcement.level = prop.value.value as number;
                break;
              case 'checked':
                states.push(prop.value.value ? 'checked' : 'not checked');
                break;
              case 'expanded':
                states.push(prop.value.value ? 'expanded' : 'collapsed');
                break;
              case 'selected':
                if (prop.value.value) states.push('selected');
                break;
              case 'disabled':
                if (prop.value.value) states.push('disabled');
                break;
              case 'required':
                if (prop.value.value) states.push('required');
                break;
              case 'invalid':
                if (prop.value.value) states.push('invalid');
                break;
            }
          }
        }
        if (states.length > 0) announcement.states = states;

        announcements.push(announcement);
      }

      const spoken = announcements.map(a => {
        if (a.role === 'text') return a.name;
        let output = '';
        if (a.role === 'heading') output += `heading level ${a.level ?? 2}, `;
        else if (a.role !== 'RootWebArea') output += `${a.role}, `;
        if (a.name) output += a.name;
        if (a.value) output += `, value: ${a.value}`;
        if (a.description) output += `, ${a.description}`;
        if (a.states) output += `, ${a.states.join(', ')}`;
        return output;
      }).filter(s => s.length > 0);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              totalAnnouncements: spoken.length,
              announcements: spoken,
              structured: announcements,
            }, null, 2),
          },
        ],
      };
    },
  );
}
