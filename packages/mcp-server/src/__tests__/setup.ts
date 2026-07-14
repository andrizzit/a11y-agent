import { createServer, type Server } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const fixturesDir = resolve(__dirname, 'fixtures');

let server: Server;
let port: number;

export function getBaseUrl(): string {
  return `http://localhost:${port}`;
}

export async function startServer(): Promise<void> {
  return new Promise((resolve) => {
    server = createServer((req, res) => {
      const filePath = `${fixturesDir}${req.url === '/' ? '/basic.html' : req.url}`;
      try {
        const content = readFileSync(filePath, 'utf-8');
        const ext = extname(filePath);
        const contentType = ext === '.html' ? 'text/html' : 'text/plain';
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      } catch {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(0, () => {
      const addr = server.address();
      port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve();
    });
  });
}

export async function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => resolve());
    } else {
      resolve();
    }
  });
}
