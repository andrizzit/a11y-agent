import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

let browser: Browser | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;
let viewport = { width: 1280, height: 720 };

export async function getPage(): Promise<Page> {
  if (!browser) {
    browser = await chromium.launch({ headless: true });
  }
  if (!context || !page || page.isClosed()) {
    context = await browser.newContext({ viewport });
    page = await context.newPage();
  }
  return page;
}

export async function navigate(url: string, waitUntil: 'load' | 'domcontentloaded' | 'networkidle' = 'networkidle'): Promise<{ url: string; title: string }> {
  const p = await getPage();
  await p.goto(url, { waitUntil });
  return { url: p.url(), title: await p.title() };
}

export async function resizeViewport(width: number, height: number): Promise<{ width: number; height: number }> {
  viewport = { width, height };
  const p = await getPage();
  await p.setViewportSize(viewport);
  return viewport;
}

export function getViewport(): { width: number; height: number } {
  return { ...viewport };
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
    context = null;
    page = null;
  }
}
