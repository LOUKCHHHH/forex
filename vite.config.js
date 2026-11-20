import { defineConfig, loadEnv } from 'vite';
import newsHandler from './api/news.js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (env.GNEWS_API_KEY) process.env.GNEWS_API_KEY ||= env.GNEWS_API_KEY;
  return {
  plugins: [{
    name: 'local-news-function',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const requestUrl = new URL(req.url || '/', 'http://localhost');
        if (requestUrl.pathname !== '/api/news') return next();
        const params = requestUrl.searchParams;
        req.query = Object.fromEntries(params.entries());
        const response = {
          setHeader: (name, value) => res.setHeader(name, value),
          status(code) { res.statusCode = code; return this; },
          json(body) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(body));
            return this;
          },
        };
        await newsHandler(req, response);
      });
    },
  }],
  };
});
