import { defineConfig, loadEnv } from 'vite';
import newsHandler from './api/news.js';
import notesHandler from './api/notes.js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (env.GNEWS_API_KEY) process.env.GNEWS_API_KEY ||= env.GNEWS_API_KEY;
  if (env.DATABASE_URL) process.env.DATABASE_URL ||= env.DATABASE_URL;
  if (env.MCFX_USERNAME) process.env.MCFX_USERNAME ||= env.MCFX_USERNAME;
  if (env.MCFX_PASSWORD) process.env.MCFX_PASSWORD ||= env.MCFX_PASSWORD;
  return {
  plugins: [{
    name: 'local-news-function',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const requestUrl = new URL(req.url || '/', 'http://localhost');
        const handler = requestUrl.pathname === '/api/news' ? newsHandler : requestUrl.pathname === '/api/notes' ? notesHandler : null;
        if (!handler) return next();
        const params = requestUrl.searchParams;
        req.query = Object.fromEntries(params.entries());
        if (['POST', 'PATCH'].includes(req.method || '')) {
          try {
            let rawBody = '';
            for await (const chunk of req) rawBody += chunk;
            req.body = rawBody ? JSON.parse(rawBody) : {};
          } catch {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Request body must be valid JSON.' }));
            return;
          }
        }
        const response = {
          setHeader: (name, value) => res.setHeader(name, value),
          status(code) { res.statusCode = code; return this; },
          json(body) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(body));
            return this;
          },
        };
        await handler(req, response);
      });
    },
  }],
  };
});
