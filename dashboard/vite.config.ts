import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import fs from 'fs';

function otterwiseApiPlugin(): Plugin {
  const otterwiseDir = path.resolve(__dirname, '../.otterwise');

  return {
    name: 'otterwise-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/api/reports') {
          const reports: { path: string; content: string }[] = [];

          function scanDir(dir: string) {
            if (!fs.existsSync(dir)) return;
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
              const fullPath = path.join(dir, entry.name);
              if (entry.isDirectory()) {
                scanDir(fullPath);
              } else if (entry.name === 'report.md') {
                const content = fs.readFileSync(fullPath, 'utf-8');
                const relPath = path.relative(otterwiseDir, fullPath);
                reports.push({ path: relPath, content });
              }
            }
          }

          scanDir(otterwiseDir);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(reports));
          return;
        }

        if (req.url?.startsWith('/api/files/')) {
          const filePath = path.join(
            otterwiseDir,
            decodeURIComponent(req.url.slice('/api/files/'.length))
          );
          const resolved = path.resolve(filePath);

          if (!resolved.startsWith(path.resolve(otterwiseDir))) {
            res.statusCode = 403;
            res.end('Forbidden');
            return;
          }

          if (!fs.existsSync(resolved)) {
            res.statusCode = 404;
            res.end('Not found');
            return;
          }

          const content = fs.readFileSync(resolved);
          res.end(content);
          return;
        }

        if (req.url?.startsWith('/api/notebooks')) {
          const parsedUrl = new URL(req.url, 'http://localhost');
          const folder = parsedUrl.searchParams.get('folder');
          const searchDir = folder
            ? path.join(otterwiseDir, folder)
            : otterwiseDir;
          const notebooks: string[] = [];

          function scanDir(dir: string) {
            if (!fs.existsSync(dir)) return;
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
              const fullPath = path.join(dir, entry.name);
              if (entry.isDirectory()) {
                scanDir(fullPath);
              } else if (entry.name.endsWith('.ipynb')) {
                notebooks.push(path.relative(otterwiseDir, fullPath));
              }
            }
          }

          scanDir(searchDir);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(notebooks));
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), otterwiseApiPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
});
