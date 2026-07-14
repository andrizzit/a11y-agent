import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { startServer, stopServer, getBaseUrl } from './setup.js';

let browser: Browser;
let page: Page;

beforeAll(async () => {
  await startServer();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  page = await context.newPage();
});

afterAll(async () => {
  await browser?.close();
  await stopServer();
});

describe('screenshot', () => {
  it('captures a PNG screenshot', async () => {
    await page.goto(`${getBaseUrl()}/basic.html`, { waitUntil: 'networkidle' });
    const buffer = await page.screenshot({ type: 'png' });
    const base64 = buffer.toString('base64');

    expect(base64.length).toBeGreaterThan(100);
    // PNG magic bytes in base64 start with "iVBOR"
    expect(base64.startsWith('iVBOR')).toBe(true);
  });

  it('captures full page screenshot', async () => {
    await page.goto(`${getBaseUrl()}/basic.html`, { waitUntil: 'networkidle' });
    const partial = await page.screenshot({ fullPage: false, type: 'png' });
    const full = await page.screenshot({ fullPage: true, type: 'png' });
    expect(full.length).toBeGreaterThanOrEqual(partial.length);
  });
});

describe('get_accessibility_tree', () => {
  it('extracts a tree with expected structure', async () => {
    await page.goto(`${getBaseUrl()}/basic.html`, { waitUntil: 'networkidle' });
    const client = await page.context().newCDPSession(page);
    const { nodes } = await client.send('Accessibility.getFullAXTree');

    expect(nodes.length).toBeGreaterThan(0);
    const root = nodes.find((n: any) => !n.parentId);
    expect(root).toBeDefined();
    expect(root!.role.value).toBe('RootWebArea');
  });

  it('contains heading nodes', async () => {
    await page.goto(`${getBaseUrl()}/basic.html`, { waitUntil: 'networkidle' });
    const client = await page.context().newCDPSession(page);
    const { nodes } = await client.send('Accessibility.getFullAXTree');

    const headings = nodes.filter((n: any) => n.role?.value === 'heading');
    expect(headings.length).toBeGreaterThanOrEqual(3);
  });
});

describe('get_tab_order', () => {
  it('returns focus sequence for focusable elements', async () => {
    await page.goto(`${getBaseUrl()}/basic.html`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.body.focus());

    const focusOrder: string[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab');
      const tag = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        return el.tagName.toLowerCase();
      });
      if (!tag) break;
      const key = `${tag}-${i}`;
      if (seen.has(key)) break;
      seen.add(key);
      focusOrder.push(tag);
    }

    expect(focusOrder.length).toBeGreaterThan(0);
    expect(focusOrder).toContain('a');
    expect(focusOrder).toContain('input');
    expect(focusOrder).toContain('button');
  });
});

describe('check_contrast', () => {
  it('detects low contrast text', async () => {
    await page.goto(`${getBaseUrl()}/basic.html`, { waitUntil: 'networkidle' });

    const elements = await page.evaluate(() => {
      const targets = Array.from(document.querySelectorAll('body *'));
      const textElements = targets.filter(el => {
        const hasDirectText = Array.from(el.childNodes).some(
          node => node.nodeType === Node.TEXT_NODE && node.textContent!.trim().length > 0
        );
        return hasDirectText;
      });

      return textElements.map(el => {
        const style = window.getComputedStyle(el);
        let bgColor = style.backgroundColor;
        let current: Element | null = el;
        while (current && (bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent')) {
          current = current.parentElement;
          if (current) bgColor = window.getComputedStyle(current).backgroundColor;
        }
        if (bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent') {
          bgColor = 'rgb(255, 255, 255)';
        }
        return {
          text: el.textContent!.trim().substring(0, 60),
          foreground: style.color,
          background: bgColor,
          className: el.className,
        };
      });
    });

    const lowContrastEl = elements.find(el => el.className === 'low-contrast');
    expect(lowContrastEl).toBeDefined();

    // Parse the low-contrast element's colors and check ratio
    const parseColor = (c: string) => {
      const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      return m ? [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])] as [number, number, number] : null;
    };
    const luminance = (r: number, g: number, b: number) => {
      const [rs, gs, bs] = [r, g, b].map(c => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    };

    const fg = parseColor(lowContrastEl!.foreground)!;
    const bg = parseColor(lowContrastEl!.background)!;
    const l1 = luminance(...fg);
    const l2 = luminance(...bg);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

    expect(ratio).toBeLessThan(4.5); // Fails WCAG AA
  });
});

describe('check_heading_hierarchy', () => {
  it('detects skipped heading levels', async () => {
    await page.goto(`${getBaseUrl()}/basic.html`, { waitUntil: 'networkidle' });

    const headings = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
      return elements.map(el => ({
        level: parseInt(el.tagName[1]),
        text: el.textContent?.trim() || '',
      }));
    });

    expect(headings.length).toBeGreaterThan(0);

    const issues: string[] = [];
    for (let i = 1; i < headings.length; i++) {
      if (headings[i].level > headings[i - 1].level + 1) {
        issues.push(`h${headings[i - 1].level} -> h${headings[i].level}`);
      }
    }

    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]).toBe('h2 -> h4');
  });

  it('identifies the h1 element', async () => {
    await page.goto(`${getBaseUrl()}/basic.html`, { waitUntil: 'networkidle' });
    const h1Count = await page.evaluate(() =>
      document.querySelectorAll('h1').length
    );
    expect(h1Count).toBe(1);
  });
});

describe('simulate_screen_reader', () => {
  it('produces announcements from the page', async () => {
    await page.goto(`${getBaseUrl()}/basic.html`, { waitUntil: 'networkidle' });
    const client = await page.context().newCDPSession(page);
    const { nodes } = await client.send('Accessibility.getFullAXTree');

    const announceable = nodes.filter(
      (n: any) => !n.ignored && n.role?.value && n.role.value !== 'none' && n.role.value !== 'generic'
    );

    expect(announceable.length).toBeGreaterThan(0);
    const roles = announceable.map((n: any) => n.role.value);
    expect(roles).toContain('heading');
    expect(roles).toContain('link');
  });

  it('scopes to a region with ariaSnapshot', async () => {
    await page.goto(`${getBaseUrl()}/basic.html`, { waitUntil: 'networkidle' });
    const snapshot = await page.locator('nav').first().ariaSnapshot();
    const lines = snapshot.split('\n').filter(l => l.trim().length > 0);
    expect(lines.length).toBeGreaterThan(0);
  });
});

describe('check_focus_visible', () => {
  it('detects elements with focus indicators', async () => {
    await page.goto(`${getBaseUrl()}/basic.html`, { waitUntil: 'networkidle' });
    const links = await page.locator('a[href]').all();
    expect(links.length).toBeGreaterThan(0);

    const firstLink = links[0];
    const unfocused = await firstLink.evaluate(el => window.getComputedStyle(el).outlineStyle);
    await firstLink.focus();
    const focused = await firstLink.evaluate(el => window.getComputedStyle(el).outlineStyle);
    await firstLink.blur();

    expect(focused).not.toBe('none');
  });

  it('detects missing focus indicators', async () => {
    await page.goto(`${getBaseUrl()}/no-focus-styles.html`, { waitUntil: 'networkidle' });
    const links = await page.locator('a[href]').all();
    expect(links.length).toBeGreaterThan(0);

    const firstLink = links[0];
    await firstLink.focus();
    const style = await firstLink.evaluate(el => {
      const s = window.getComputedStyle(el);
      return { outline: s.outlineStyle, boxShadow: s.boxShadow };
    });

    expect(style.outline).toBe('none');
    expect(style.boxShadow).toBe('none');
  });
});

describe('interact', () => {
  it('clicks a button and toggles state', async () => {
    await page.goto(`${getBaseUrl()}/interactive.html`, { waitUntil: 'networkidle' });
    const btn = page.locator('#toggle-btn');

    expect(await btn.getAttribute('aria-expanded')).toBe('false');
    await btn.click();
    expect(await btn.getAttribute('aria-expanded')).toBe('true');

    const menu = page.locator('#menu');
    expect(await menu.getAttribute('aria-hidden')).toBe('false');
  });

  it('types into an input', async () => {
    await page.goto(`${getBaseUrl()}/interactive.html`, { waitUntil: 'networkidle' });
    const input = page.locator('#search');
    await input.fill('accessibility');
    expect(await input.inputValue()).toBe('accessibility');
  });

  it('presses a key on an element', async () => {
    await page.goto(`${getBaseUrl()}/interactive.html`, { waitUntil: 'networkidle' });
    const input = page.locator('#search');
    await input.focus();
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.id);
    expect(focused).not.toBe('search');
  });
});

describe('navigate', () => {
  it('navigates to a URL and loads the page', async () => {
    await page.goto(`${getBaseUrl()}/basic.html`, { waitUntil: 'networkidle' });
    expect(page.url()).toContain('/basic.html');
    const title = await page.title();
    expect(title).toBe('Test Page');
  });

  it('navigates between pages', async () => {
    await page.goto(`${getBaseUrl()}/interactive.html`, { waitUntil: 'networkidle' });
    expect(await page.title()).toBe('Interactive Page');
    await page.goto(`${getBaseUrl()}/basic.html`, { waitUntil: 'networkidle' });
    expect(await page.title()).toBe('Test Page');
  });
});

describe('resize_viewport', () => {
  it('resizes the viewport', async () => {
    await page.setViewportSize({ width: 375, height: 667 });
    const size = page.viewportSize();
    expect(size?.width).toBe(375);
    expect(size?.height).toBe(667);
  });

  it('restores viewport after resize', async () => {
    await page.setViewportSize({ width: 1280, height: 720 });
    const size = page.viewportSize();
    expect(size?.width).toBe(1280);
    expect(size?.height).toBe(720);
  });
});
