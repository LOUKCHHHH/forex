# FXbrief

A personal market news dashboard built with React and Vite. Choose a currency pair, commodity, index, or cryptocurrency, filter headlines by date, optionally limit results to the official Federal Reserve domain, and fetch current English-language news in separate article cards. Searches need no extra keyword.

The dashboard has a shared login-only screen with initial username `mc` and password `mc1234`; there is no registration. The Profile page lets you change the shared username and password for everyone. Login sessions use an HttpOnly cookie, and passwords are saved as one-way hashes in Upstash Redis. This is intended for a shared personal dashboard, not high-security account access.

The dashboard includes a **Market conditions** page that highlights scheduled Forex Factory events for the selected instrument. It is an event-risk view only; it does not use live prices, measure volatility or liquidity, or determine whether a particular trade is safe. The **Market sessions** page shows conventional Sydney, Tokyo, London, and New York FX session hours in each city's local time and updates for daylight-saving changes. Session definitions and broker hours can differ, so use your broker's schedule for instrument-specific availability.

## Run locally

```sh
npm install
npm run dev
```

Open the URL printed by Vite. Do not open `index.html` directly or use a static-only preview server: those do not run the `/api/news` backend route.

## Shared login storage

The login requires an Upstash Redis database so username/password changes are shared between browsers. In Vercel, open the project **Storage** or **Marketplace**, create/connect an Upstash Redis database, and ensure `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are available to the project. Redeploy after connecting it. For local Vite development, copy those two values from the Upstash database into `.env.local` along with `GNEWS_API_KEY`. The first use initializes the shared login to `mc` / `mc1234`; change it in the Profile page. Existing sessions in other browsers are signed out after a password change and must sign in with the new credentials.

## Live news setup

The `/api/news` Vercel Function calls the GNews search endpoint for all-source market searches. Create a GNews API key, copy `.env.example` to `.env.local`, and replace the placeholder with your key to use live market news locally. For Vercel, add `GNEWS_API_KEY` under **Project → Settings → Environment Variables** for the deployments you use and redeploy. The key stays on the server and is never sent to the browser. Market searches use instrument-specific terms, an optional date interval, recent publication ordering, and English language filtering.

The Federal Reserve source option reads official Fed monetary policy releases, speeches, and testimony directly from the [Fed RSS feeds](https://www.federalreserve.gov/feeds/feeds.htm), so it does not require a GNews key. The **Federal Reserve + CNBC** option combines those official feeds with CNBC articles returned by GNews, then keeps only CNBC links whose text is about the Federal Reserve or FOMC. CNBC coverage needs `GNEWS_API_KEY`; if CNBC is unavailable, the official Fed items still appear. Article photos supplied by GNews are displayed on the story cards, with a bundled FXbrief chart illustration used when a story has no working photo. The dashboard also links to the official [Federal Reserve News & Events calendar](https://www.federalreserve.gov/newsevents.htm).

Select **Forex Factory calendar events** to load its published [weekly JSON calendar export](https://nfs.faireconomy.media/ff_calendar_thisweek.json). The route caches the response for an hour and filters scheduled events to currencies relevant to the selected market, the chosen date range, and the impact filter. Event cards show the published impact tier, event time, forecast, and previous value; Forex Factory's export is a current-week schedule, not a historical event archive. The calendar remains linked as the canonical source. Headline news cards use a separate rule-based potential-market-impact label from headline and summary keywords (very high, high, medium, or low). Neither label is a prediction of price movement or an assessment of risk to a specific position. See [Forex Factory terms](https://www.forexfactory.com/notices).

Without the environment variable, all-source market news shows a setup error; the Federal Reserve feed remains available. Provider quotas and plan limits apply. GNews Free applies a 12-hour freshness delay, so the most recent date ranges may return no articles on that plan. The app links to each publisher; it does not reproduce full articles. Headlines are live news; the app does not display live market quotes or prices.

## Deployment

Vercel detects Vite and deploys the root-level `api/news.js` serverless function alongside the static app. Set the output directory to `dist` if Vercel does not detect it automatically.
