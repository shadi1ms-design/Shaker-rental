import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    // Dynamic import: 'vite' is a devDependency and must not be required in production.
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    const server = http.createServer((req, res) => {
      const url = req.url || '/';

      if (url === '/api/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
        return;
      }

      vite.middlewares(req, res, async () => {
        if (url.startsWith('/api')) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'API route not found' }));
          return;
        }

        try {
          const templatePath = path.resolve(process.cwd(), 'index.html');
          let template = fs.readFileSync(templatePath, 'utf-8');
          template = await vite.transformIndexHtml(url, template);
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(template);
        } catch (e: any) {
          vite.ssrFixStacktrace(e);
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end(e?.stack || String(e));
        }
      });
    });

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Development server running on http://localhost:${PORT}`);
    });
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    const server = http.createServer((req, res) => {
      const url = req.url || '/';

      if (url === '/api/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
        return;
      }

      let requestPath = '/';
      try {
        requestPath = decodeURIComponent(url.split('?')[0].split('#')[0]);
      } catch {
        requestPath = '/';
      }
      const filePath = path.resolve(distPath, '.' + (requestPath === '/' ? '/index.html' : requestPath));
      const insideDist = filePath === distPath || filePath.startsWith(distPath + path.sep);
      if (insideDist && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath);
        const mimeTypes: Record<string, string> = {
          '.html': 'text/html',
          '.js': 'application/javascript',
          '.css': 'text/css',
          '.json': 'application/json',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.svg': 'image/svg+xml',
          '.ico': 'image/x-icon',
          '.webp': 'image/webp',
          '.webmanifest': 'application/manifest+json',
          '.woff2': 'font/woff2',
          '.woff': 'font/woff',
          '.map': 'application/json',
          '.txt': 'text/plain',
        };
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
        const stream = fs.createReadStream(filePath);
        stream.on('error', () => { if (!res.headersSent) res.writeHead(500); res.end(); });
        stream.pipe(res);
      } else if (path.extname(requestPath)) {
        // Missing static asset: return 404 instead of the SPA shell
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
      } else {
        const indexPath = path.join(distPath, 'index.html');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        fs.createReadStream(indexPath).pipe(res);
      }
    });

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Production server running on http://localhost:${PORT}`);
    });
  }
}

startServer();
