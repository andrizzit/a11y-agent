import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock playwright so these tests never launch a real browser: no network, no
// browser download, no cost. We only assert the concurrency behaviour of
// browser.ts (the serialization mutex and the getPage init-race guard).
const newPage = vi.fn();
const newContext = vi.fn();
const launch = vi.fn();

vi.mock('playwright', () => ({
  chromium: {
    launch: (...args: unknown[]) => launch(...args),
  },
}));

// Import AFTER the mock is registered. Fresh module state per test via resetModules.
async function loadBrowser() {
  vi.resetModules();
  const pageObj = { isClosed: () => false, setViewportSize: vi.fn(), goto: vi.fn(), url: () => 'about:blank', title: async () => '' };
  newPage.mockReset().mockResolvedValue(pageObj);
  newContext.mockReset().mockImplementation(async () => ({ newPage }));
  launch.mockReset().mockImplementation(async () => ({ newContext }));
  const mod = await import('../browser.js');
  return { mod, pageObj };
}

describe('runExclusive', () => {
  it('serializes overlapping work: the second call starts only after the first finishes', async () => {
    const { mod } = await loadBrowser();
    const order: string[] = [];
    let releaseFirst: () => void = () => {};
    const firstGate = new Promise<void>((res) => { releaseFirst = res; });

    const first = mod.runExclusive(async () => {
      order.push('first:start');
      await firstGate; // hold the lock
      order.push('first:end');
    });
    const second = mod.runExclusive(async () => {
      order.push('second:start');
    });

    // Give the event loop a tick; second must NOT have started while first holds the lock.
    await Promise.resolve();
    expect(order).toEqual(['first:start']);

    releaseFirst();
    await Promise.all([first, second]);
    expect(order).toEqual(['first:start', 'first:end', 'second:start']);
  });

  it('keeps the chain alive after a rejected task (a failing call does not wedge the queue)', async () => {
    const { mod } = await loadBrowser();
    const failing = mod.runExclusive(async () => { throw new Error('boom'); });
    await expect(failing).rejects.toThrow('boom');
    // A subsequent call still runs.
    const ok = await mod.runExclusive(async () => 42);
    expect(ok).toBe(42);
  });
});

describe('getPage init-race guard', () => {
  beforeEach(() => {
    launch.mockClear();
    newContext.mockClear();
    newPage.mockClear();
  });

  it('creates the browser, context, and page exactly once under concurrent first calls', async () => {
    const { mod, pageObj } = await loadBrowser();

    // Fire many concurrent getPage() calls before any has resolved.
    const results = await Promise.all(
      Array.from({ length: 5 }, () => mod.getPage()),
    );

    // The race guard means launch/newContext/newPage each happen only once...
    expect(launch).toHaveBeenCalledTimes(1);
    expect(newContext).toHaveBeenCalledTimes(1);
    expect(newPage).toHaveBeenCalledTimes(1);

    // ...and every caller got the SAME page instance.
    for (const p of results) {
      expect(p).toBe(pageObj);
    }
  });
});
