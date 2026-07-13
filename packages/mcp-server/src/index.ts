import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerScreenshotTool } from './tools/screenshot.js';
import { registerAccessibilityTreeTool } from './tools/accessibility-tree.js';
import { registerTabOrderTool } from './tools/tab-order.js';
import { registerCheckContrastTool } from './tools/check-contrast.js';
import { registerCheckHeadingHierarchyTool } from './tools/check-heading-hierarchy.js';
import { registerSimulateScreenReaderTool } from './tools/simulate-screen-reader.js';
import { registerCheckFocusVisibleTool } from './tools/check-focus-visible.js';
import { registerInteractTool } from './tools/interact.js';
import { registerNavigateTool } from './tools/navigate.js';
import { registerResizeViewportTool } from './tools/resize-viewport.js';

export const server = new McpServer({
  name: 'a11y-agent-mcp',
  version: '0.1.0',
});

registerScreenshotTool(server);
registerAccessibilityTreeTool(server);
registerTabOrderTool(server);
registerCheckContrastTool(server);
registerCheckHeadingHierarchyTool(server);
registerSimulateScreenReaderTool(server);
registerCheckFocusVisibleTool(server);
registerInteractTool(server);
registerNavigateTool(server);
registerResizeViewportTool(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();
