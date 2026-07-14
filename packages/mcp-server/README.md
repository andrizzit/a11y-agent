# @a11y-agent/mcp-server

An MCP (Model Context Protocol) server that exposes accessibility auditing tools for AI agents. It uses Playwright and headless Chromium to analyze web pages for WCAG compliance issues.

## Tools

| Tool | Description |
|------|-------------|
| `screenshot` | Capture a full-page or viewport screenshot as base64 PNG |
| `get_accessibility_tree` | Extract the Chromium accessibility tree as structured JSON |
| `get_tab_order` | Simulate Tab key presses and return the focus sequence |
| `check_contrast` | Check WCAG 2.1 color contrast ratios (AA/AAA) |
| `check_heading_hierarchy` | Validate h1-h6 nesting (skipped levels, missing/multiple h1) |
| `simulate_screen_reader` | Return screen reader announcement sequence |
| `check_focus_visible` | Verify focusable elements have visible focus indicators |
| `interact` | Click, hover, type, scroll, focus, or press keys on elements |
| `navigate` | Navigate the browser to a URL |
| `resize_viewport` | Resize the browser viewport for responsive testing |

## Usage

### As a stdio MCP server

```bash
npx @a11y-agent/mcp-server
```

### Claude Desktop configuration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "a11y-agent": {
      "command": "node",
      "args": ["path/to/packages/mcp-server/dist/index.js"]
    }
  }
}
```

### Programmatic usage

```typescript
import { server } from '@a11y-agent/mcp-server';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const transport = new StdioServerTransport();
await server.connect(transport);
```

## Tool Details

### screenshot

Captures a PNG screenshot of any URL.

```json
{
  "url": "https://example.com",
  "fullPage": true
}
```

Returns an image content block with base64-encoded PNG data.

### get_accessibility_tree

Extracts the full Chromium accessibility tree using CDP.

```json
{
  "url": "https://example.com"
}
```

Returns a nested JSON tree with roles, names, descriptions, values, and ARIA properties.

### get_tab_order

Simulates Tab key presses to discover the keyboard navigation order.

```json
{
  "url": "https://example.com",
  "maxSteps": 50
}
```

Returns an array of focused elements in order, with selectors, roles, and tab indices.

### check_contrast

Computes WCAG contrast ratios for all text elements (or a scoped region).

```json
{
  "url": "https://example.com",
  "selector": "main"
}
```

Returns a summary with passing/failing counts and detailed failure information including computed foreground/background colors and contrast ratios.

### check_heading_hierarchy

Validates that heading levels (h1-h6) follow proper nesting rules.

```json
{
  "url": "https://example.com"
}
```

Reports skipped levels, missing h1, or multiple h1 elements.

### simulate_screen_reader

Produces the announcement sequence a screen reader would speak.

```json
{
  "url": "https://example.com",
  "selector": "nav"
}
```

Without a selector, returns the full page announcement list. With a selector, uses Playwright's `ariaSnapshot` to scope to a region.

### check_focus_visible

Checks WCAG 2.4.7 compliance — that every focusable element has a visible focus indicator.

```json
{
  "url": "https://example.com",
  "selector": "nav a"
}
```

Compares computed styles between focused and unfocused states to detect outline, box-shadow, border, or background changes.

### interact

Performs user interactions on page elements to test dynamic states.

```json
{
  "url": "https://example.com",
  "selector": "#menu-button",
  "action": "click"
}
```

Supported actions: `click`, `hover`, `type`, `scroll`, `focus`, `press`. After interaction, reports the element's updated ARIA state and any newly visible dialogs, menus, or tooltips.

### navigate

Navigates the shared browser session to a URL.

```json
{
  "url": "https://example.com",
  "waitUntil": "networkidle"
}
```

### resize_viewport

Changes the viewport size for responsive layout testing.

```json
{
  "width": 375,
  "height": 667
}
```

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run tests
pnpm test

# Watch mode
pnpm dev
```

## Architecture

The server manages a shared Playwright browser session across all tool calls. A single headless Chromium instance is reused, which keeps tool invocations fast while allowing the agent to build up page state across multiple interactions.

```
MCP Client (Agent)
    │
    ▼ (stdio JSON-RPC)
┌─────────────────────────┐
│  MCP Server             │
│  ├── browser.ts         │ ← shared browser session
│  └── tools/             │
│      ├── screenshot     │
│      ├── a11y-tree      │
│      ├── tab-order      │
│      ├── contrast       │
│      ├── headings       │
│      ├── screen-reader  │
│      ├── focus-visible  │
│      ├── interact       │
│      ├── navigate       │
│      └── viewport       │
└─────────────────────────┘
    │
    ▼
  Playwright (headless Chromium)
```

## License

MIT
