# a11y-agent

An AI-powered accessibility auditor that uses an autonomous agent to analyze websites for WCAG compliance issues. The agent controls a headless browser through custom MCP tools — checking contrast, heading structure, keyboard navigation, focus indicators, and screen reader compatibility.

## Architecture

```
┌──────────────┐       ┌──────────────┐       ┌──────────────────┐
│ React SPA    │       │ App Runner   │       │ Agent Worker     │
│ (S3/CF)      │──────▶│ (API)        │──────▶│ - Strands Agent  │
└──────────────┘  SSE  └──────────────┘       │ - MCP Server     │
                                              │ - Playwright     │
                       ┌──────────────┐       │ - Bedrock/Claude │
                       │ DynamoDB     │◀──────└──────────────────┘
                       └──────────────┘
```

The agent (Claude on Bedrock) decides which checks to run and interprets results. The MCP server provides the tools — each one does a specific accessibility analysis using a real headless browser.

## MCP Tools

| Tool | What it checks |
|------|---------------|
| `screenshot` | Capture page as PNG for visual analysis |
| `get_accessibility_tree` | Extract what assistive tech actually sees (CDP) |
| `get_tab_order` | Simulate Tab navigation, detect keyboard traps |
| `check_contrast` | WCAG 2.1 color contrast (AA/AAA) |
| `check_heading_hierarchy` | Heading nesting (h1-h6) |
| `simulate_screen_reader` | Screen reader announcement sequence |
| `check_focus_visible` | Visible focus indicators (WCAG 2.4.7) |
| `interact` | Click/hover/type to test dynamic UI states |
| `navigate` | Browser navigation |
| `resize_viewport` | Responsive layout testing |

## Tech Stack

- **Monorepo:** Turborepo + pnpm workspaces
- **MCP Server:** @modelcontextprotocol/sdk, Playwright, Zod
- **Agent:** Strands Agents SDK + Amazon Bedrock (Claude Sonnet)
- **API:** Express/Fastify with SSE streaming
- **Frontend:** React + Vite + TailwindCSS
- **Infrastructure:** AWS CDK (App Runner, DynamoDB, S3, CloudFront)

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 11+
- AWS credentials with Bedrock access (for the agent)

### Setup

```bash
git clone https://github.com/andrizzit/a11y-agent.git
cd a11y-agent
pnpm install

# Copy and configure environment
cp .env.example .env
```

### Build

```bash
pnpm build
```

### Use the MCP Server standalone

The MCP server works with any MCP-compatible client (Claude Desktop, etc.):

```json
{
  "mcpServers": {
    "a11y-agent": {
      "command": "node",
      "args": ["packages/mcp-server/dist/index.js"]
    }
  }
}
```

### Run tests

```bash
pnpm test
```

## Project Structure

```
packages/
├── mcp-server/   # MCP tools (Playwright + CDP)
├── agent/        # Strands Agent (Bedrock/Claude)
├── api/          # REST API + SSE streaming
└── web/          # React frontend
```

## Status

- [x] MCP Server — 10 tools, tested, documented
- [x] Agent bootstrap — Strands + Bedrock wired
- [x] Agent ↔ MCP connection — agent discovers and calls all 10 tools
- [x] Agent system prompt — audit methodology, severity model, structured output format
- [ ] Agent audit orchestration
- [ ] Backend API with SSE
- [ ] Frontend
- [ ] AWS deployment (CDK)

## References

### Standards

- [WCAG 2.1](https://www.w3.org/TR/WCAG21/) — Web Content Accessibility Guidelines
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) — Latest version (2023)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/) — Design patterns for accessible widgets
- [ARIA in HTML](https://www.w3.org/TR/html-aria/) — Which ARIA roles/attributes are allowed on HTML elements

### Key WCAG Criteria Covered

- [1.3.1 Info and Relationships](https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships) — heading hierarchy
- [1.4.3 Contrast (Minimum)](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum) — 4.5:1 ratio
- [2.1.1 Keyboard](https://www.w3.org/WAI/WCAG21/Understanding/keyboard) — tab order, keyboard traps
- [2.4.7 Focus Visible](https://www.w3.org/WAI/WCAG21/Understanding/focus-visible) — visible focus indicators
- [4.1.2 Name, Role, Value](https://www.w3.org/WAI/WCAG21/Understanding/name-role-value) — accessibility tree

### Tools & Protocols

- [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) — open standard for AI tool integration
- [Strands Agents SDK](https://github.com/strands-agents/sdk-typescript) — TypeScript agent framework
- [Playwright](https://playwright.dev/) — browser automation
- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/) — low-level browser API

## License

MIT
