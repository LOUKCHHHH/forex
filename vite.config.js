import { defineConfig, loadEnv } from 'vite';
import newsHandler from './api/news.js';
import authHandler from './api/auth.js';
import forexFactoryHandler from './api/forexfactory.js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (env.GNEWS_API_KEY) process.env.GNEWS_API_KEY ||= env.GNEWS_API_KEY;
  if (env.UPSTASH_REDIS_REST_URL) process.env.UPSTASH_REDIS_REST_URL ||= env.UPSTASH_REDIS_REST_URL;
  if (env.UPSTASH_REDIS_REST_TOKEN) process.env.UPSTASH_REDIS_REST_TOKEN ||= env.UPSTASH_REDIS_REST_TOKEN;
  return {
  plugins: [{
    name: 'local-news-function',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const requestUrl = new URL(req.url || '/', 'http://localhost');
        const handlers = { '/api/news': newsHandler, '/api/auth': authHandler, '/api/forexfactory': forexFactoryHandler };
        const handler = handlers[requestUrl.pathname];
        if (!handler) return next();
        const params = requestUrl.searchParams;
        req.query = Object.fromEntries(params.entries());
        if (requestUrl.pathname === '/api/auth' && req.method === 'POST') {
          let body = '';
          for await (const chunk of req) body += chunk;
          try { req.body = JSON.parse(body || '{}'); }
          catch { res.statusCode = 400; res.end(JSON.stringify({ error: 'Invalid JSON request body.' })); return; }
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
