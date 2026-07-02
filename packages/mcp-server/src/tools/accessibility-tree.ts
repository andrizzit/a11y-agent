import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getPage } from '../browser.js';

interface AXNode {
  nodeId: string;
  ignored?: boolean;
  role?: { value: string };
  name?: { value: string };
  description?: { value: string };
  value?: { value: string };
  properties?: Array<{ name: string; value: { value: unknown } }>;
  parentId?: string;
  childIds?: string[];
}

interface TreeNode {
  role: string;
  name?: string;
  description?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: TreeNode[];
}

function buildTree(nodes: AXNode[]): TreeNode | null {
  const nodeMap = new Map<string, AXNode>();
  for (const node of nodes) {
    nodeMap.set(node.nodeId, node);
  }

  function convert(node: AXNode): TreeNode | null {
    if (node.ignored) {
      const children = (node.childIds ?? [])
        .map(id => nodeMap.get(id))
        .filter((n): n is AXNode => !!n)
        .map(convert)
        .filter((n): n is TreeNode => !!n);
      if (children.length === 1) return children[0];
      if (children.length > 1) return { role: 'group', children };
      return null;
    }

    const result: TreeNode = { role: node.role?.value ?? 'unknown' };
    if (node.name?.value) result.name = node.name.value;
    if (node.description?.value) result.description = node.description.value;
    if (node.value?.value) result.value = node.value.value;

    if (node.properties?.length) {
      const props: Record<string, unknown> = {};
      for (const prop of node.properties) {
        props[prop.name] = prop.value.value;
      }
      result.properties = props;
    }

    const children = (node.childIds ?? [])
      .map(id => nodeMap.get(id))
      .filter((n): n is AXNode => !!n)
      .map(convert)
      .filter((n): n is TreeNode => !!n);
    if (children.length > 0) result.children = children;

    return result;
  }

  const root = nodes.find(n => !n.parentId);
  return root ? convert(root) : null;
}

export function registerAccessibilityTreeTool(server: McpServer) {
  server.tool(
    'get_accessibility_tree',
    'Extract the accessibility tree from the current page as structured JSON',
    {
      url: z.string().url().describe('The URL to analyze'),
    },
    async ({ url }) => {
      const page = await getPage();
      await page.goto(url, { waitUntil: 'networkidle' });

      const client = await page.context().newCDPSession(page);
      const { nodes } = await client.send('Accessibility.getFullAXTree');
      const tree = buildTree(nodes as AXNode[]);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(tree, null, 2),
          },
        ],
      };
    },
  );
}
