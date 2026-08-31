import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

let browser: Browser | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;
let viewport = { width: 1280, height: 720 };

// The MCP server drives a SINGLE shared Playwright page. When the agent issues
// several browser tool calls concurrently they would otherwise interleave
// navigations/evaluations on that one page — and two calls hitting an
// uninitialized page would each create a context, orphaning the first page and
// failing its in-flight operation. `runExclusive` serializes browser work
// through a promise chain so concurrent calls queue instead of colliding.
let tail: Promise<unknown> = Promise.resolve();

export function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = tail.then(fn, fn);
  // Keep the chain alive regardless of individual outcomes.
  tail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

// Guard concurrent initialization: without the in-flight promises, several
// callers that all find `browser`/`page` null would each launch/create, and the
// extra instances would overwrite the module-level state out from under the
// callers already using it.
let browserInit: Promise<Browser> | null = null;
let pageInit: Promise<Page> | null = null;

async function ensureBrowser(): Promise<Browser> {
  if (browser) {
    return browser;
  }
  if (!browserInit) {
    browserInit = chromium
      .launch({ headless: true })
      .then((b) => {
        browser = b;
        return b;
      })
      .finally(() => {
        browserInit = null;
      });
  }
  return browserInit;
}

export async function getPage(): Promise<Page> {
  const b = await ensureBrowser();
  if (context && page && !page.isClosed()) {
    return page;
  }
  if (!pageInit) {
    pageInit = (async () => {
      context = await b.newContext({ viewport });
      page = await context.newPage();
      return page;
    })().finally(() => {
      pageInit = null;
    });
  }
  return pageInit;
}

export async function navigate(url: string, waitUntil: 'load' | 'domcontentloaded' | 'networkidle' = 'networkidle'): Promise<{ url: string; title: string }> {
  return runExclusive(async () => {
    const p = await getPage();
    await p.goto(url, { waitUntil });
    return { url: p.url(), title: await p.title() };
  });
}

export async function resizeViewport(width: number, height: number): Promise<{ width: number; height: number }> {
  return runExclusive(async () => {
    viewport = { width, height };
    const p = await getPage();
    await p.setViewportSize(viewport);
    return viewport;
  });
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
