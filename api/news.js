const PAIRS = {
  'EUR/USD': ['"EUR/USD" OR EURUSD OR (euro AND "US dollar")'], 'GBP/USD': ['"GBP/USD" OR GBPUSD OR ("British pound" AND "US dollar")'],
  'USD/JPY': ['"USD/JPY" OR USDJPY OR ("US dollar" AND "Japanese yen")'], 'USD/CHF': ['"USD/CHF" OR USDCHF OR ("US dollar" AND "Swiss franc")'],
  'AUD/USD': ['"AUD/USD" OR AUDUSD OR ("Australian dollar" AND "US dollar")'], 'USD/CAD': ['"USD/CAD" OR USDCAD OR ("US dollar" AND "Canadian dollar")'],
  'NZD/USD': ['"NZD/USD" OR NZDUSD OR ("New Zealand dollar" AND "US dollar")'], 'EUR/GBP': ['"EUR/GBP" OR EURGBP OR (euro AND "British pound")'],
  'EUR/JPY': ['"EUR/JPY" OR EURJPY OR (euro AND "Japanese yen")'], 'GBP/JPY': ['"GBP/JPY" OR GBPJPY OR ("British pound" AND "Japanese yen")'],
  'EUR/CHF': ['"EUR/CHF" OR EURCHF OR (euro AND "Swiss franc")'], 'AUD/JPY': ['"AUD/JPY" OR AUDJPY OR ("Australian dollar" AND "Japanese yen")'],
  'USD/CNH': ['"USD/CNH" OR USDCNH OR ("US dollar" AND "Chinese yuan")'], 'USD/MXN': ['"USD/MXN" OR USDMXN OR ("US dollar" AND "Mexican peso")'],
  'USD/ZAR': ['"USD/ZAR" OR USDZAR OR ("US dollar" AND "South African rand")'], 'USD/TRY': ['"USD/TRY" OR USDTRY OR ("US dollar" AND "Turkish lira")'],
  'USD/SEK': ['"USD/SEK" OR USDSEK OR ("US dollar" AND "Swedish krona")'], 'USD/NOK': ['"USD/NOK" OR USDNOK OR ("US dollar" AND "Norwegian krone")'],
  'USD/SGD': ['"USD/SGD" OR USDSGD OR ("US dollar" AND "Singapore dollar")'], 'USD/HKD': ['"USD/HKD" OR USDHKD OR ("US dollar" AND "Hong Kong dollar")'],
  'USD/INR': ['"USD/INR" OR USDINR OR ("US dollar" AND "Indian rupee")'], 'USD/BRL': ['"USD/BRL" OR USDBRL OR ("US dollar" AND "Brazilian real")'],
  'USD/KRW': ['"USD/KRW" OR USDKRW OR ("US dollar" AND "South Korean won")'], 'USD/PLN': ['"USD/PLN" OR USDPLN OR ("US dollar" AND "Polish zloty")'],
  'XAU/USD': ['"XAU/USD" OR XAUUSD OR "gold price" OR "gold market"'], 'XAG/USD': ['"XAG/USD" OR XAGUSD OR "silver price" OR "silver market"'],
  'WTI': ['WTI OR "West Texas Intermediate" OR "US crude oil"'], 'BRENT': ['Brent OR "Brent crude" OR "Brent oil price"'],
  'NASDAQ': ['"Nasdaq 100" OR NDX OR "Nasdaq index" OR "Nasdaq futures"'], 'S&P 500': ['"S&P 500" OR SPX OR "S&P futures"'],
  'DOW': ['"Dow Jones Industrial Average" OR "Dow Jones" OR "Dow futures"'], 'DAX': ['"DAX 40" OR "DAX index" OR "DAX futures"'],
  'FTSE 100': ['"FTSE 100" OR "FTSE index" OR "FTSE futures"'], 'NIKKEI': ['"Nikkei 225" OR "Nikkei index" OR "Nikkei futures"'],
  'BTC/USD': ['"BTC/USD" OR BTCUSD OR Bitcoin OR "Bitcoin price"'], 'ETH/USD': ['"ETH/USD" OR ETHUSD OR Ethereum OR "Ethereum price"']
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Use GET to search news.' });
  const pair = String(req.query.pair || '').toUpperCase();
  const pairQuery = PAIRS[pair]?.[0];
  if (!pairQuery) return res.status(400).json({ error: 'Choose a supported market.' });
  const apiKey = process.env.GNEWS_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'Live news is not configured. Locally, add GNEWS_API_KEY to .env.local and restart Vite. On Vercel, add it in Project Settings → Environment Variables, then redeploy.' });
  const params = new URLSearchParams({ q: pairQuery, lang: 'en', max: '10', sortby: 'publishedAt', apikey: apiKey });
  try {
    const upstream = await fetch(`https://gnews.io/api/v4/search?${params}`);
    const payload = await upstream.json();
    if (!upstream.ok) return res.status(upstream.status === 429 ? 429 : 502).json({ error: payload.errors?.[0] || 'The news provider could not complete this search.' });
    const articles = (payload.articles || []).filter(a => a.title && a.url).map(a => ({ title: a.title, description: a.description, content: a.content, url: a.url, image: a.image, publishedAt: a.publishedAt, source: a.source }));
    return res.status(200).json({ pair, articles });
  } catch { return res.status(502).json({ error: 'Could not connect to the news provider. Try again shortly.' }); }
}
