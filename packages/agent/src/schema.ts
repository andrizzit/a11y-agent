import { z } from 'zod';

export const FindingSchema = z.object({
  issue: z.string().describe('Clear, specific description of the accessibility problem'),
  severity: z.enum(['critical', 'major', 'minor']).describe('Impact level'),
  wcagCriteria: z.string().describe('WCAG success criterion violated (e.g., "1.4.3 Contrast (Minimum)")'),
  wcagLevel: z.enum(['A', 'AA', 'AAA']).describe('WCAG conformance level'),
  element: z.string().describe('CSS selector or description of the affected element'),
  evidence: z.string().describe('Data from the tool proving the issue'),
  suggestion: z.string().describe('Concrete, actionable fix'),
  confidence: z.enum(['high', 'moderate']).describe('high = directly measured by tool, moderate = inferred from visual or partial data'),
});

export const AuditReportSchema = z.object({
  url: z.string().describe('The URL that was audited'),
  timestamp: z.string().describe('ISO 8601 timestamp of the audit'),
  findings: z.array(FindingSchema).describe('List of accessibility issues found'),
  summary: z.object({
    total: z.number().describe('Total number of issues'),
    critical: z.number().describe('Count of critical issues'),
    major: z.number().describe('Count of major issues'),
    minor: z.number().describe('Count of minor issues'),
    conformanceLevel: z.enum(['fails_A', 'A', 'AA', 'AAA']).describe('Estimated WCAG conformance level'),
    topPriorities: z.array(z.string()).max(3).describe('Top 3 issues to fix first'),
  }),
});

export type Finding = z.infer<typeof FindingSchema>;
export type AuditReport = z.infer<typeof AuditReportSchema>;
