import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import fs from 'fs';

interface ReportFrontmatter {
  id: string;
  name: string;
  parentIds: string[];
  dataset: string;
  status: string;
  findingsCount: number;
}

interface ReportEntry {
  path: string;
  frontmatter: ReportFrontmatter;
  content: string;
}

function parseFrontmatter(raw: string): { frontmatter: Record<string, unknown>; content: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, content: raw };

  const fm: Record<string, unknown> = {};
  for (const line of match[1].split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf(':');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value: string | unknown = trimmed.slice(idx + 1).trim();
    // Parse YAML arrays: ["a", "b"] or []
    if (typeof value === 'string' && value.startsWith('[')) {
      try {
        value = JSON.parse(value.replace(/'/g, '"'));
      } catch {
        value = [];
      }
    }
    // Parse numbers
    if (typeof value === 'string' && /^\d+$/.test(value)) {
      value = parseInt(value, 10);
    }
    // Strip surrounding quotes
    if (typeof value === 'string') {
      value = value.replace(/^["']|["']$/g, '');
    }
    fm[key] = value;
  }

  return { frontmatter: fm, content: match[2] };
}

function otterwiseApiPlugin(): Plugin {
  const otterwiseDir = process.env.OTTERWISE_DIR
    ? path.resolve(process.env.OTTERWISE_DIR)
    : path.resolve(__dirname, '../.otterwise');
  const nodesDir = path.join(otterwiseDir, 'nodes');

  return {
    name: 'otterwise-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // GET /api/reports — scan .otterwise/nodes/*/report.md, return with parsed frontmatter
        if (req.url === '/api/reports') {
          const reports: ReportEntry[] = [];

          if (fs.existsSync(nodesDir)) {
            const nodeDirs = fs.readdirSync(nodesDir, { withFileTypes: true });
            for (const nodeDir of nodeDirs) {
              if (!nodeDir.isDirectory()) continue;
              const reportPath = path.join(nodesDir, nodeDir.name, 'report.md');
              if (!fs.existsSync(reportPath)) continue;

              const raw = fs.readFileSync(reportPath, 'utf-8');
              const { frontmatter, content } = parseFrontmatter(raw);
              reports.push({
                path: `nodes/${nodeDir.name}/report.md`,
                frontmatter: {
                  id: (frontmatter.id as string) || nodeDir.name,
                  name: (frontmatter.name as string) || '',
                  parentIds: (frontmatter.parentIds as string[]) || [],
                  dataset: (frontmatter.dataset as string) || '',
                  status: (frontmatter.status as string) || 'unknown',
                  findingsCount: (frontmatter.findingsCount as number) || 0,
                },
                content,
              });
            }
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(reports));
          return;
        }

        // GET /api/status — return autopilot.json and autopilot-state.json
        if (req.url === '/api/status') {
          const autopilotPath = path.join(otterwiseDir, 'autopilot.json');
          const statePath = path.join(otterwiseDir, 'autopilot-state.json');

          const result: { autopilot: unknown; state: unknown } = {
            autopilot: null,
            state: null,
          };

          if (fs.existsSync(autopilotPath)) {
            try {
              result.autopilot = JSON.parse(fs.readFileSync(autopilotPath, 'utf-8'));
            } catch { /* ignore parse errors */ }
          }
          if (fs.existsSync(statePath)) {
            try {
              result.state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
            } catch { /* ignore parse errors */ }
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
          return;
        }

        // GET /api/files/{path} — serve files from .otterwise/ with path traversal protection
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
