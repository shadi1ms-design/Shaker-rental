import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
const PORT = Number(process.env.PORT) || 3000;

// Keep in sync with the Content-Security-Policy header in firebase.json (Firebase Hosting).
const CONTENT_SECURITY_POLICY =
  "default-src 'self'; frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; script-src 'self' https://apis.google.com https://www.gstatic.com https://www.google.com https://www.recaptcha.net https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https://*.googleapis.com https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.google.com/recaptcha/ https://www.google.com/recaptcha/enterprise/ https://www.recaptcha.net https://apis.google.com https://www.gstatic.com https://cloudfunctions.net https://*.cloudfunctions.net https://firebasestorage.googleapis.com https://content-firebaseappcheck.googleapis.com https://firebaseappcheck.googleapis.com https://firebaseinstallations.googleapis.com https://*.run.app https://storage.googleapis.com https://fcmregistrations.googleapis.com https://fcm.googleapis.com https://www.google-analytics.com https://*.google-analytics.com https://analytics.google.com https://www.googletagmanager.com; frame-src 'self' https://*.firebaseapp.com https://*.google.com https://www.google.com;";

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

      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
      res.setHeader('Content-Security-Policy', CONTENT_SECURITY_POLICY);

      if (url === '/api/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
        return;
      }

      // Static hosting only: no other verbs are meaningful here.
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { Allow: 'GET, HEAD', 'Content-Type': 'text/plain' });
        res.end('Method Not Allowed');
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
      // `vite build` also emits the bundled server (dist/server.cjs + source map) into dist/.
      // Never serve it (or any dotfile / source map) to the public: it exposes server source code.
      const relativePath = path.relative(distPath, filePath);
      const isPrivateArtifact =
        /^server\.cjs(\.map)?$/.test(relativePath) ||
        relativePath.split(path.sep).some((seg) => seg.startsWith('.')) ||
        relativePath.endsWith('.map');
      if (insideDist && isPrivateArtifact) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
        return;
      }
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
        const isHashedAsset = relativePath.split(path.sep)[0] === 'assets';
        res.writeHead(200, {
          'Content-Type': mimeTypes[ext] || 'application/octet-stream',
          // Same caching policy as firebase.json: hashed assets are immutable, everything else revalidates.
          'Cache-Control': isHashedAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
        });
        const stream = fs.createReadStream(filePath);
        stream.on('error', () => { if (!res.headersSent) res.writeHead(500); res.end(); });
        stream.pipe(res);
      } else if (path.extname(requestPath)) {
        // Missing static asset: return 404 instead of the SPA shell
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
      } else {
        const indexPath = path.join(distPath, 'index.html');
        res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-cache, no-store, must-revalidate' });
        fs.createReadStream(indexPath).pipe(res);
      }
    });

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Production server running on http://localhost:${PORT}`);
    });
  }
}

startServer();
