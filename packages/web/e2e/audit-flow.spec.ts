import { expect, test, type Page } from '@playwright/test';

const job = {
  id: 'job-e2e',
  url: 'https://example.com',
  status: 'queued',
  createdAt: '2026-08-11T12:00:00.000Z',
  updatedAt: '2026-08-11T12:00:00.000Z',
};

const report = {
  url: job.url,
  timestamp: '2026-08-11T12:00:05.000Z',
  findings: [
    {
      issue: 'Form input has no accessible label',
      severity: 'major',
      wcagCriteria: '1.3.1',
      wcagLevel: 'A',
      element: '<input id="email">',
      evidence: 'The accessibility tree exposes an unnamed textbox.',
      suggestion: 'Associate a visible label with the input.',
      confidence: 'high',
    },
  ],
  summary: {
    total: 1,
    critical: 0,
    major: 1,
    minor: 0,
    conformanceLevel: 'fails_A',
    topPriorities: ['Add a label to the email input'],
  },
};

function sseEvent(type: string, data: Record<string, unknown>) {
  return `event: ${type}\ndata: ${JSON.stringify({
    jobId: job.id,
    type,
    timestamp: '2026-08-11T12:00:01.000Z',
    data,
  })}\n\n`;
}

async function mockSuccessfulAudit(page: Page, auditReport: typeof report) {
  await page.route('**/api/audits', async route => {
    await new Promise(resolve => setTimeout(resolve, 150));
    await route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify(job) });
  });

  await page.route(`**/api/audits/${job.id}/stream`, async route => {
    const body = [
      sseEvent('status_change', { status: 'running' }),
      sseEvent('tool_start', { tool: 'screenshot' }),
      sseEvent('tool_complete', { tool: 'screenshot', durationMs: 420 }),
      sseEvent('complete', { status: 'complete', report: auditReport }),
    ].join('');

    await route.fulfill({
      status: 200,
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
      },
      body,
    });
  });
}

test('submits an audit, receives SSE progress, and displays results', async ({ page }) => {
  await mockSuccessfulAudit(page, report);
  await page.goto('/');

  await page.getByLabel('URL to audit').fill(job.url);
  await page.getByRole('button', { name: 'Audit' }).click();

  await expect(page.getByRole('status', { name: 'Submitting audit' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Summary' })).toBeVisible();
  await expect(page.getByText('Form input has no accessible label')).toBeVisible();
  await expect(page.getByText('1.3.1')).toBeVisible();
  await expect(page.getByText('Audit complete')).toBeVisible();
});

test('shows a recoverable API error', async ({ page }) => {
  await page.route('**/api/audits', route => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ message: 'Audit service is temporarily unavailable' }),
  }));
  await page.goto('/');

  await page.getByLabel('URL to audit').fill(job.url);
  await page.getByRole('button', { name: 'Audit' }).click();

  await expect(page.getByRole('heading', { name: 'We couldn’t complete the audit' })).toBeVisible();
  await expect(page.getByText('Audit service is temporarily unavailable')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry audit' })).toBeVisible();
});

test('shows the empty state when no findings are returned', async ({ page }) => {
  const emptyReport = {
    ...report,
    findings: [],
    summary: {
      ...report.summary,
      total: 0,
      major: 0,
      conformanceLevel: 'AA',
      topPriorities: [],
    },
  };
  await mockSuccessfulAudit(page, emptyReport);
  await page.goto('/');

  await page.getByLabel('URL to audit').fill(job.url);
  await page.getByRole('button', { name: 'Audit' }).click();

  await expect(page.getByRole('heading', { name: 'No accessibility issues found' })).toBeVisible();
  await expect(page.getByText('Manual testing is still recommended')).toBeVisible();
});
