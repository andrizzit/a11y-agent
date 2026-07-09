import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getPage } from '../browser.js';

interface FocusVisibleResult {
  selector: string;
  tagName: string;
  text: string;
  role: string | null;
  hasFocusIndicator: boolean;
  indicators: string[];
}

export function registerCheckFocusVisibleTool(server: McpServer) {
  server.tool(
    'check_focus_visible',
    'Check that focusable elements have a visible focus indicator (WCAG 2.4.7)',
    {
      url: z.string().url().describe('The URL to analyze'),
      selector: z.string().optional().describe('CSS selector to scope the check (default: all focusable elements)'),
    },
    async ({ url, selector }) => {
      const page = await getPage();
      await page.goto(url, { waitUntil: 'networkidle' });

      const focusableSelector = selector ?? [
        'a[href]',
        'button',
        'input:not([type="hidden"])',
        'select',
        'textarea',
        '[tabindex]:not([tabindex="-1"])',
        '[contenteditable]',
        'details > summary',
      ].join(', ');

      const elements = await page.evaluate((sel) => {
        const nodes = Array.from(document.querySelectorAll(sel));
        return nodes.slice(0, 50).map((el, i) => {
          const tagName = el.tagName.toLowerCase();
          const id = el.id ? `#${el.id}` : '';
          const cls = el.className && typeof el.className === 'string'
            ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.')
            : '';
          return {
            index: i,
            selector: `${tagName}${id}${cls}`,
            tagName,
            text: (el.textContent || '').trim().substring(0, 50),
            role: el.getAttribute('role'),
          };
        });
      }, focusableSelector);

      const results: FocusVisibleResult[] = [];

      for (const el of elements) {
        const focusData = await page.evaluate(({ sel, idx }) => {
          const nodes = Array.from(document.querySelectorAll(sel));
          const node = nodes[idx] as HTMLElement;
          if (!node) return null;

          const getStyleSnapshot = (element: Element) => {
            const style = window.getComputedStyle(element);
            return {
              outline: style.outline,
              outlineStyle: style.outlineStyle,
              outlineWidth: style.outlineWidth,
              outlineColor: style.outlineColor,
              outlineOffset: style.outlineOffset,
              border: style.border,
              borderColor: style.borderColor,
              borderWidth: style.borderWidth,
              boxShadow: style.boxShadow,
              backgroundColor: style.backgroundColor,
              textDecoration: style.textDecoration,
              opacity: style.opacity,
              transform: style.transform,
            };
          };

          const unfocused = getStyleSnapshot(node);
          node.focus();
          const focused = getStyleSnapshot(node);
          node.blur();

          return { unfocused, focused };
        }, { sel: focusableSelector, idx: el.index });

        if (!focusData) continue;

        const indicators: string[] = [];
        const { unfocused, focused } = focusData;

        if (focused.outlineStyle !== 'none' && focused.outlineStyle !== unfocused.outlineStyle) {
          indicators.push(`outline: ${focused.outline}`);
        } else if (focused.outlineStyle !== 'none' && focused.outlineWidth !== '0px' && focused.outlineWidth !== unfocused.outlineWidth) {
          indicators.push(`outline: ${focused.outline}`);
        }

        if (focused.boxShadow !== unfocused.boxShadow && focused.boxShadow !== 'none') {
          indicators.push(`box-shadow: ${focused.boxShadow}`);
        }

        if (focused.borderColor !== unfocused.borderColor) {
          indicators.push(`border-color change: ${unfocused.borderColor} → ${focused.borderColor}`);
        }
        if (focused.borderWidth !== unfocused.borderWidth) {
          indicators.push(`border-width change: ${unfocused.borderWidth} → ${focused.borderWidth}`);
        }

        if (focused.backgroundColor !== unfocused.backgroundColor) {
          indicators.push(`background change: ${unfocused.backgroundColor} → ${focused.backgroundColor}`);
        }

        if (focused.textDecoration !== unfocused.textDecoration) {
          indicators.push(`text-decoration change: ${unfocused.textDecoration} → ${focused.textDecoration}`);
        }

        if (focused.transform !== unfocused.transform) {
          indicators.push(`transform change`);
        }

        if (focused.outlineStyle !== 'none' && focused.outlineWidth !== '0px' && indicators.length === 0) {
          indicators.push(`outline: ${focused.outline}`);
        }

        results.push({
          selector: el.selector,
          tagName: el.tagName,
          text: el.text,
          role: el.role,
          hasFocusIndicator: indicators.length > 0,
          indicators,
        });
      }

      const passing = results.filter(r => r.hasFocusIndicator);
      const failing = results.filter(r => !r.hasFocusIndicator);

      const summary = {
        totalChecked: results.length,
        passing: passing.length,
        failing: failing.length,
        wcagCriterion: '2.4.7 Focus Visible (Level AA)',
        failures: failing,
        details: results,
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
