import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getPage } from '../browser.js';

interface Heading {
  level: number;
  text: string;
  selector: string;
}

interface HierarchyIssue {
  type: 'skipped_level' | 'multiple_h1' | 'missing_h1';
  message: string;
  element?: Heading;
  previousLevel?: number;
}

export function registerCheckHeadingHierarchyTool(server: McpServer) {
  server.tool(
    'check_heading_hierarchy',
    'Validate heading hierarchy (h1-h6) for proper nesting and structure',
    {
      url: z.string().url().describe('The URL to analyze'),
    },
    async ({ url }) => {
      const page = await getPage();
      await page.goto(url, { waitUntil: 'networkidle' });

      const headings: Heading[] = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
        return elements.map((el, i) => {
          const tagName = el.tagName.toLowerCase();
          const id = el.id ? `#${el.id}` : '';
          return {
            level: parseInt(tagName[1]),
            text: el.textContent?.trim().substring(0, 100) || '',
            selector: `${tagName}${id}:nth-of-type(${i + 1})`,
          };
        });
      });

      const issues: HierarchyIssue[] = [];

      const h1Count = headings.filter(h => h.level === 1).length;
      if (h1Count === 0 && headings.length > 0) {
        issues.push({ type: 'missing_h1', message: 'Page has no h1 element' });
      }
      if (h1Count > 1) {
        issues.push({ type: 'multiple_h1', message: `Page has ${h1Count} h1 elements (expected 1)` });
      }

      for (let i = 1; i < headings.length; i++) {
        const prev = headings[i - 1];
        const curr = headings[i];
        if (curr.level > prev.level + 1) {
          issues.push({
            type: 'skipped_level',
            message: `Heading level skipped from h${prev.level} to h${curr.level}`,
            element: curr,
            previousLevel: prev.level,
          });
        }
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              totalHeadings: headings.length,
              headings,
              issues,
              valid: issues.length === 0,
            }, null, 2),
          },
        ],
      };
    },
  );
}
