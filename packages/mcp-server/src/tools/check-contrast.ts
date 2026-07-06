import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getPage } from '../browser.js';

interface ContrastResult {
  selector: string;
  text: string;
  fontSize: string;
  fontWeight: string;
  foreground: string;
  background: string;
  contrastRatio: number;
  isLargeText: boolean;
  aa: boolean;
  aaa: boolean;
}

function parseColor(color: string): [number, number, number] | null {
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return null;
  return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
}

function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(fg: [number, number, number], bg: [number, number, number]): number {
  const l1 = relativeLuminance(...fg);
  const l2 = relativeLuminance(...bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function registerCheckContrastTool(server: McpServer) {
  server.tool(
    'check_contrast',
    'Check WCAG color contrast ratios for text elements on the page',
    {
      url: z.string().url().describe('The URL to analyze'),
      selector: z.string().optional().describe('CSS selector to scope the check (default: all text elements)'),
    },
    async ({ url, selector }) => {
      const page = await getPage();
      await page.goto(url, { waitUntil: 'networkidle' });

      const elements = await page.evaluate((sel) => {
        const targets = sel
          ? Array.from(document.querySelectorAll(sel))
          : Array.from(document.querySelectorAll('body *'));

        const textElements = targets.filter(el => {
          const hasDirectText = Array.from(el.childNodes).some(
            node => node.nodeType === Node.TEXT_NODE && node.textContent!.trim().length > 0
          );
          return hasDirectText;
        });

        return textElements.slice(0, 100).map(el => {
          const style = window.getComputedStyle(el);
          const tagName = el.tagName.toLowerCase();
          const id = el.id ? `#${el.id}` : '';
          const cls = el.className && typeof el.className === 'string'
            ? '.' + el.className.trim().split(/\s+/).join('.')
            : '';

          let bgColor = style.backgroundColor;
          let current: Element | null = el;
          while (current && (bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent')) {
            current = current.parentElement;
            if (current) {
              bgColor = window.getComputedStyle(current).backgroundColor;
            }
          }
          if (bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent') {
            bgColor = 'rgb(255, 255, 255)';
          }

          return {
            selector: `${tagName}${id}${cls}`,
            text: el.textContent!.trim().substring(0, 60),
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            foreground: style.color,
            background: bgColor,
          };
        });
      }, selector ?? null);

      const results: ContrastResult[] = [];
      const failures: ContrastResult[] = [];

      for (const el of elements) {
        const fg = parseColor(el.foreground);
        const bg = parseColor(el.background);
        if (!fg || !bg) continue;

        const ratio = Math.round(contrastRatio(fg, bg) * 100) / 100;
        const fontSizePx = parseFloat(el.fontSize);
        const fontWeight = parseInt(el.fontWeight);
        const isLargeText = fontSizePx >= 24 || (fontSizePx >= 18.66 && fontWeight >= 700);

        const aa = isLargeText ? ratio >= 3 : ratio >= 4.5;
        const aaa = isLargeText ? ratio >= 4.5 : ratio >= 7;

        const result: ContrastResult = {
          ...el,
          contrastRatio: ratio,
          isLargeText,
          aa,
          aaa,
        };

        results.push(result);
        if (!aa) failures.push(result);
      }

      const summary = {
        totalChecked: results.length,
        passing: results.length - failures.length,
        failing: failures.length,
        failures,
      };

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(summary, null, 2),
          },
        ],
      };
    },
  );
}
