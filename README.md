# FXbrief

A personal market news dashboard built with React and Vite. Choose a currency pair, commodity, index, or cryptocurrency, filter headlines by date, optionally limit results to the official Federal Reserve domain, and fetch current English-language news in separate article cards. Searches need no extra keyword.

The dashboard has a login-only screen with the static username `mc` and password `mc1234`; there is no registration. Login persists for the current browser tab. This is a client-side personal-use gate, not secure authentication: the credentials are included in the frontend bundle.

## Run locally

```sh
npm install
npm run dev
```

Open the URL printed by Vite. Do not open `index.html` directly or use a static-only preview server: those do not run the `/api/news` backend route.

## Live news setup

The `/api/news` Vercel Function calls the GNews search endpoint for all-source market searches. Create a GNews API key, copy `.env.example` to `.env.local`, and replace the placeholder with your key to use live market news locally. For Vercel, add `GNEWS_API_KEY` under **Project → Settings → Environment Variables** for the deployments you use and redeploy. The key stays on the server and is never sent to the browser. Market searches use instrument-specific terms, an optional date interval, recent publication ordering, and English language filtering.

The Federal Reserve source option reads official Fed monetary policy releases, speeches, and testimony directly from the [Fed RSS feeds](https://www.federalreserve.gov/feeds/feeds.htm), so it does not require a GNews key. The **Federal Reserve + CNBC** option combines those official feeds with CNBC articles returned by GNews, then keeps only CNBC links whose text is about the Federal Reserve or FOMC. CNBC coverage needs `GNEWS_API_KEY`; if CNBC is unavailable, the official Fed items still appear. Article photos supplied by GNews are displayed on the story cards. The dashboard also links to the official [Federal Reserve News & Events calendar](https://www.federalreserve.gov/newsevents.htm) for scheduled events.

Without the environment variable, all-source market news shows a setup error; the Federal Reserve feed remains available. Provider quotas and plan limits apply. GNews Free applies a 12-hour freshness delay, so the most recent date ranges may return no articles on that plan. The app links to each publisher; it does not reproduce full articles. Headlines are live news; the app does not display live market quotes or prices.

## Deployment

Vercel detects Vite and deploys the root-level `api/news.js` serverless function alongside the static app. Set the output directory to `dist` if Vercel does not detect it automatically.
