# MCFX

A personal market news dashboard built with React and Vite. Choose a currency pair, commodity, index, or cryptocurrency, filter headlines by date, optionally limit results to the official Federal Reserve domain, and fetch current English-language news in separate article cards. Searches need no extra keyword.

The dashboard has a login-only screen with initial username `mc` and password `mc1234`; there is no registration. The Profile page lets you change them for the current browser. Login persists for the current browser tab. Credentials are stored in browser local storage, so this is a client-side personal-use gate, not secure authentication.

The dashboard includes a **Market conditions** page that highlights scheduled Forex Factory events for the selected instrument. It is an event-risk view only; it does not use live prices, measure volatility or liquidity, or determine whether a particular trade is safe. The **Market sessions** page shows conventional Sydney, Tokyo, London, and New York FX session hours in each city's local time and updates for daylight-saving changes. Session definitions and broker hours can differ, so use your broker's schedule for instrument-specific availability.

Pin markets in the Watchlist for quick selection; watchlist choices are saved in the current browser. Market conditions includes a countdown to the next high-impact calendar event. Optional browser notifications fire 15 minutes before a high-impact event while the Market conditions page is open and notification permission is granted.

## Run locally

```sh
npm install
npm run dev
```

Open the URL printed by Vite. Do not open `index.html` directly or use a static-only preview server: those do not run the `/api/news` backend route.

## Live news setup

The `/api/news` Vercel Function calls the GNews search endpoint for all-source market searches. Create a GNews API key, copy `.env.example` to `.env.local`, and replace the placeholder with your key to use live market news locally. For Vercel, add `GNEWS_API_KEY` under **Project → Settings → Environment Variables** for the deployments you use and redeploy. The key stays on the server and is never sent to the browser. Market searches use instrument-specific terms, an optional date interval, recent publication ordering, and English language filtering.

The Federal Reserve source option reads official Fed monetary policy releases, speeches, and testimony directly from the [Fed RSS feeds](https://www.federalreserve.gov/feeds/feeds.htm), so it does not require a GNews key. The **Federal Reserve + CNBC** option combines those official feeds with CNBC articles returned by GNews, then keeps only CNBC links whose text is about the Federal Reserve or FOMC. CNBC coverage needs `GNEWS_API_KEY`; if CNBC is unavailable, the official Fed items still appear. Article photos supplied by GNews are displayed on the story cards, with a bundled MCFX chart illustration used when a story has no working photo. The dashboard also links to the official [Federal Reserve News & Events calendar](https://www.federalreserve.gov/newsevents.htm).

Select **Forex Factory calendar events** to load its published [weekly JSON calendar export](https://nfs.faireconomy.media/ff_calendar_thisweek.json). The route caches the response for an hour and filters scheduled events to currencies relevant to the selected market, the chosen date range, and the impact filter. Event cards show the published impact tier, event time, forecast, and previous value; Forex Factory's export is a current-week schedule, not a historical event archive. The calendar remains linked as the canonical source. Headline news cards use a separate rule-based potential-market-impact label from headline and summary keywords (very high, high, medium, or low). Neither label is a prediction of price movement or an assessment of risk to a specific position. See [Forex Factory terms](https://www.forexfactory.com/notices).

Without the environment variable, all-source market news shows a setup error; the Federal Reserve feed remains available. Provider quotas and plan limits apply. GNews Free applies a 12-hour freshness delay, so the most recent date ranges may return no articles on that plan. The app links to each publisher; it does not reproduce full articles. Headlines are live news; the app does not display live market quotes or prices.

## Database-backed news archive

News results are stored in Postgres when `DATABASE_URL` is configured. The API creates its tables on first use, canonicalizes article URLs (removing common tracking parameters), and enforces a unique content key so repeated searches and pagination do not create duplicate stories. Forex Factory events use their currency, title, and release time as their identity because all events link to the same calendar page. Stored results are associated with the selected market and source, then returned as paginated results. If the database is not connected or temporarily unavailable, live results continue to work and the API reports that they were not saved.

To enable storage locally, set `DATABASE_URL` in `.env.local`. For Vercel, install a Postgres Marketplace integration such as Neon and connect it to this project; Vercel supplies the connection environment variable. Redeploy after adding it. See [Vercel Marketplace storage](https://vercel.com/docs/marketplace-storage) and [Neon's Vercel integration](https://vercel.com/marketplace/neon).

## Deployment

Vercel detects Vite and deploys the root-level `api/news.js` serverless function alongside the static app. Set the output directory to `dist` if Vercel does not detect it automatically.
