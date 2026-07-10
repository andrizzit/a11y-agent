import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getPage } from '../browser.js';

const ActionSchema = z.enum(['click', 'hover', 'type', 'scroll', 'focus', 'press']);

export function registerInteractTool(server: McpServer) {
  server.tool(
    'interact',
    'Interact with an element on the page (click, hover, type, scroll, focus, press key)',
    {
      url: z.string().url().describe('The URL to interact with'),
      selector: z.string().describe('CSS selector of the target element'),
      action: ActionSchema.describe('The interaction to perform'),
      value: z.string().optional().describe('Text to type (for "type" action) or key to press (for "press" action, e.g. "Enter", "Escape", "Tab")'),
      scrollDirection: z.enum(['up', 'down', 'left', 'right']).optional().describe('Scroll direction (for "scroll" action)'),
      scrollAmount: z.number().optional().describe('Scroll amount in pixels (default: 300)'),
    },
    async ({ url, selector, action, value, scrollDirection, scrollAmount }) => {
      const page = await getPage();

      const currentUrl = page.url();
      if (currentUrl !== url) {
        await page.goto(url, { waitUntil: 'networkidle' });
      }

      const element = page.locator(selector).first();
      await element.waitFor({ state: 'visible', timeout: 5000 });

      let description = '';

      switch (action) {
        case 'click':
          await element.click();
          description = `Clicked "${selector}"`;
          break;

        case 'hover':
          await element.hover();
          description = `Hovered over "${selector}"`;
          break;

        case 'type':
          if (!value) {
            return {
              content: [{ type: 'text' as const, text: JSON.stringify({ error: 'value is required for "type" action' }) }],
            };
          }
          await element.fill(value);
          description = `Typed "${value}" into "${selector}"`;
          break;

        case 'scroll': {
          const dir = scrollDirection ?? 'down';
          const amount = scrollAmount ?? 300;
          const deltaX = dir === 'right' ? amount : dir === 'left' ? -amount : 0;
          const deltaY = dir === 'down' ? amount : dir === 'up' ? -amount : 0;
          await element.hover();
          await page.mouse.wheel(deltaX, deltaY);
          description = `Scrolled ${dir} by ${amount}px at "${selector}"`;
          break;
        }

        case 'focus':
          await element.focus();
          description = `Focused "${selector}"`;
          break;

        case 'press':
          if (!value) {
            return {
              content: [{ type: 'text' as const, text: JSON.stringify({ error: 'value is required for "press" action (e.g. "Enter", "Escape")' }) }],
            };
          }
          await element.focus();
          await page.keyboard.press(value);
          description = `Pressed "${value}" on "${selector}"`;
          break;
      }

      await page.waitForTimeout(300);

      const snapshot = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return {
          tagName: el.tagName.toLowerCase(),
          text: (el.textContent || '').trim().substring(0, 100),
          ariaExpanded: el.getAttribute('aria-expanded'),
          ariaHidden: el.getAttribute('aria-hidden'),
          ariaSelected: el.getAttribute('aria-selected'),
          ariaChecked: el.getAttribute('aria-checked'),
          ariaDisabled: el.getAttribute('aria-disabled'),
          disabled: (el as HTMLButtonElement).disabled ?? null,
          visible: rect.width > 0 && rect.height > 0,
        };
      }, selector);

      const newElements = await page.evaluate(() => {
        const dialogs = Array.from(document.querySelectorAll('dialog[open], [role="dialog"]:not([aria-hidden="true"]), [role="alertdialog"]:not([aria-hidden="true"])'));
        const menus = Array.from(document.querySelectorAll('[role="menu"]:not([aria-hidden="true"]), [role="listbox"]:not([aria-hidden="true"])'));
        const tooltips = Array.from(document.querySelectorAll('[role="tooltip"]:not([aria-hidden="true"])'));

        return {
          openDialogs: dialogs.map(d => ({
            role: d.getAttribute('role') || 'dialog',
            label: d.getAttribute('aria-label') || d.getAttribute('aria-labelledby') || '',
          })),
          openMenus: menus.map(m => ({
            role: m.getAttribute('role'),
            items: Array.from(m.querySelectorAll('[role="menuitem"], [role="option"], li')).length,
          })),
          visibleTooltips: tooltips.map(t => ({
            text: (t.textContent || '').trim().substring(0, 100),
          })),
        };
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              action: description,
              elementState: snapshot,
              dynamicContent: newElements,
              currentUrl: page.url(),
            }, null, 2),
          },
        ],
      };
    },
  );
}
