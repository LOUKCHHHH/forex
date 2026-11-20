# FXbrief

A personal market news dashboard built with React and Vite. Choose a currency pair, commodity, index, or cryptocurrency, then fetch current English-language news in separate article cards. Searches need no extra keyword.

The dashboard has a login-only screen with the static username `mc` and password `mc1234`; there is no registration. Login persists for the current browser tab. This is a client-side personal-use gate, not secure authentication: the credentials are included in the frontend bundle.

## Run locally

```sh
npm install
npm run dev
```

Open the URL printed by Vite. Do not open `index.html` directly or use a static-only preview server: those do not run the `/api/news` backend route.

## Live news setup

The `/api/news` Vercel Function calls the GNews search endpoint. Create a GNews API key, copy `.env.example` to `.env.local`, and replace the placeholder with your key to use live news locally. For Vercel, add `GNEWS_API_KEY` under **Project → Settings → Environment Variables** for the deployments you use and redeploy. The key stays on the server and is never sent to the browser. Searches use terms specific to the selected market, recent publication ordering, and English language filtering.

Without the environment variable, the app shows a setup error instead of sample articles. Provider quotas and plan limits apply. The app links to each publisher; it does not reproduce full articles. Headlines are live news; the app does not display live market quotes or prices.

## Deployment

Vercel detects Vite and deploys the root-level `api/news.js` serverless function alongside the static app. Set the output directory to `dist` if Vercel does not detect it automatically.
